/**
 * Recovers article bylines from the old site's rendered pages.
 *
 * The REST API does not carry them. `content.rendered` has no 文／ line, `acf`
 * is empty and `meta` holds only WordPress's own keys, which is why the import
 * produced 15,514 articles with no author. The byline is real, though -- the
 * theme renders it into an Elementor post-info item:
 *
 *   <span class="… elementor-post-info__item--type-custom">文／陈光诚｜著名维权人士</span>
 *
 * So it can only be read off the page. One page per article, about a second
 * each through the proxy.
 *
 * Resumable by construction: it only asks for articles whose author is still
 * empty, and writes each one as it goes. Killing it and starting again picks up
 * where it stopped.
 *
 *   npx tsx scripts/harvest-authors.ts --limit 50 --dry-run
 *   npx tsx scripts/harvest-authors.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { appendFileSync, readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROXY = "https://r.jina.ai/";
const LOG = "artifacts/phase5/authors.log";

/** The theme's byline slot. Everything else on the page is chrome. */
const POST_INFO = /elementor-post-info__item--type-custom[^>]*>\s*([^<]{2,80}?)\s*</g;

interface Byline { author: string; affiliation: string }

/**
 * Reads a byline out of a page.
 *
 * 文／ is the common form. 责任编辑 and （记者…报导） appear on older pieces, and
 * are taken only when no 文／ is present -- an editor is not an author, but an
 * attributed editor beats nothing at all.
 */
export function bylineFrom(html: string): Byline | null {
  const items = [...html.matchAll(POST_INFO)].map((match) => match[1].trim());
  const authored = items.find((item) => /^文[／/]/.test(item));
  if (authored) {
    const rest = authored.replace(/^文[／/]\s*/, "");
    const [name, affiliation = ""] = rest.split(/[｜|]/);
    return { author: name.trim(), affiliation: affiliation.trim() };
  }

  // Older news reports attribute in the body instead: （退党中心记者 黄真报导）,
  // （大纪元记者李新纽约报导）. The outlet sits before 记者 and varies, so it is
  // matched loosely and kept as the affiliation rather than thrown away.
  const reporter = html.match(
    /[（(]\s*([^）)（(]{0,10}?)[记編编]者\s*([^）)]{1,18}?)\s*(?:报导|報導|報道|报道|採訪|采访|编译|編譯)?\s*[）)]/
  );
  if (reporter) return { author: reporter[2].trim(), affiliation: reporter[1].trim() };

  const editor = items.find((item) => /^责任编辑/.test(item));
  if (editor) return { author: editor.replace(/^责任编辑[：:]\s*/, "").trim(), affiliation: "" };

  return null;
}

/** A name, not a sentence -- the theme's custom slot is free text. */
function plausible(name: string): boolean {
  if (name.length < 2 || name.length > 40) return false;
  if (/[。！？，,;；]/.test(name)) return false;
  return true;
}

async function fetchPage(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${PROXY}${url}`, {
        headers: { "x-respond-with": "html", "user-agent": "quitccp-author-migrator/1.0" }
      });
      if (response.ok) {
        const html = await response.text();
        // A rate-limit or challenge answer is far shorter than a real page.
        if (html.length > 20_000) return html;
      }
    } catch {
      // Fall through to the backoff.
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  return null;
}

/**
 * Writes one author, retrying a statement timeout.
 *
 * A single-row update on a primary key should not take seconds, but the import
 * hit 57014 on single rows too: it is load on the instance, not the row. One
 * slow write is no reason to abandon a run of fifteen thousand -- the article
 * keeps author = '' and the next run picks it up.
 */
async function writeAuthor(id: string, author: string): Promise<boolean> {
  for (const wait of [0, 2000, 5000, 15000]) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const { error } = await supabase.from("cms_articles").update({ author }).eq("id", id);
    if (!error) return true;
    if (error.code !== "57014") throw error;
  }
  return false;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg === -1 ? Number.POSITIVE_INFINITY : Number(process.argv[limitArg + 1]);

  let timedOut = 0;
  let found = 0;
  let none = 0;
  let unreadable = 0;
  let seen = 0;

  // Build the worklist once, by keyset on the primary key.
  //
  // The first version re-queried `author = '' ORDER BY published_at` every 500
  // rows and Postgres cancelled it on a statement timeout: sorting a
  // fifteen-thousand-row filtered set over and over is expensive, and `author`
  // is not indexed. Paging by `id` uses the primary key, runs once, and the
  // ordering costs nothing in memory.
  const worklist: { id: string; title: string; legacyUrl: string; publishedAt: string }[] = [];
  let cursor = "";
  for (;;) {
    let query = supabase
      .from("cms_articles")
      .select("id, title, legacy_url, published_at, author")
      .order("id", { ascending: true })
      .limit(1000);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (String(row.author ?? "") !== "" || !row.legacy_url) continue;
      worklist.push({
        id: String(row.id),
        title: String(row.title),
        legacyUrl: String(row.legacy_url),
        publishedAt: String(row.published_at ?? "")
      });
    }
    cursor = String(data[data.length - 1].id);
    process.stderr.write(`[worklist] 已扫描到 ${worklist.length} 篇待补作者\n`);
    if (data.length < 1000) break;
  }

  // Newest first: those are the pieces readers land on, and the ones most
  // likely to still carry a byline.
  worklist.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  process.stderr.write(`[authors] 待处理 ${worklist.length} 篇\n`);

  for (const article of worklist) {
    if (seen >= limit) break;
    seen += 1;
    const url = article.legacyUrl.startsWith("http")
      ? article.legacyUrl
      : `https://www.tuidang.org${article.legacyUrl}`;

    const html = await fetchPage(url);
    if (!html) {
      unreadable += 1;
      continue;
    }
    const byline = bylineFrom(html);
    if (!byline || !plausible(byline.author)) {
      none += 1;
      continue;
    }
    found += 1;

    if (apply) {
      const written = await writeAuthor(article.id, byline.author);
      if (!written) {
        timedOut += 1;
        continue;
      }
      appendFileSync(LOG, `${article.id}\t${byline.author}\t${byline.affiliation}\t${article.title}\n`);
    } else {
      console.log(` ${byline.author}${byline.affiliation ? `（${byline.affiliation}）` : ""} — ${article.title}`);
    }

    if (seen % 50 === 0) {
      process.stderr.write(
        `[authors] 已查 ${seen}/${worklist.length} · 找到 ${found} · 无署名 ${none} · 读不到 ${unreadable}\n`
      );
    }
  }

  console.log(
    JSON.stringify(
      { mode: apply ? "apply" : "dry-run", checked: seen, found, noByline: none, unreadable, timedOut },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
