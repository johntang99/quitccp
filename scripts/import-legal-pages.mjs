/**
 * Imports the privacy policy and the terms of service from the old site.
 *
 * Both live only on www.tuidang.org, which becomes this site at the cutover,
 * and service.tuidang.org links to those same copies -- so every page's footer
 * on both sites was about to break. They land here as /legal/privacy and
 * /legal/terms, editable in the admin like any other page.
 *
 * Cloudflare blocks direct fetches of the old site, so the source text is read
 * from the r.jina.ai markdown proxy -- the same route the WP article sync uses.
 * The proxy's header (Title/URL Source/Published Time) is stripped, and the
 * run-on bold headings it produces ("**简介**全球退党...") are split back onto
 * their own lines.
 *
 *   node --env-file=.env.local scripts/import-legal-pages.mjs
 *   node --env-file=.env.local scripts/import-legal-pages.mjs --apply
 *   node --env-file=.env.local scripts/import-legal-pages.mjs --restore backups/legal-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const RESTORE = (() => {
  const i = process.argv.indexOf("--restore");
  return i === -1 ? null : process.argv[i + 1];
})();

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PAGES = [
  {
    slug: "privacy",
    source: "https://www.tuidang.org/privacy-policy/",
    title: "隐私政策",
    subtitle: "办理退党证明时我们收集哪些信息、如何使用、以及如何保护。",
    updated: "2020-08-09"
  },
  {
    slug: "terms",
    source: "https://www.tuidang.org/terms-of-service/",
    title: "服务条款",
    subtitle: "使用本网站与办理退党证明的条件、版权声明与免责范围。",
    updated: "2020-08-09"
  }
];

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of backup.entries) {
    if (c.before === null) {
      await s.from("cms_content_entries").delete().eq("path", c.path).eq("locale", "zh");
    } else {
      await s.from("cms_content_entries").update({ data: c.before }).eq("path", c.path).eq("locale", "zh");
    }
  }
  for (const p of backup.pages ?? []) {
    if (p.before === null) {
      await s.from("cms_pages").delete().eq("section", "legal").eq("slug", p.slug).eq("locale", "zh");
    }
  }
  console.log(`  已还原 ${backup.entries.length} 个条目`);
  process.exit(0);
}

/** Turn the proxy's markdown into the body we store. */
function clean(raw) {
  let body = raw;
  // Drop the proxy's own header block.
  const marker = "Markdown Content:";
  const at = body.indexOf(marker);
  if (at !== -1) body = body.slice(at + marker.length);

  return (
    body
      .replace(/\r\n/g, "\n")
      // The source runs a bold heading straight into its paragraph. Split them
      // so each becomes a real heading with its text beneath.
      .replace(/^\*\*([^*\n]{1,40})\*\*(?=\S)/gm, "## $1\n\n")
      .replace(/^\*\*([^*\n]{1,40})\*\*[ \t]*$/gm, "## $1")
      // The lettered sub-points under 信息收集 sit below a heading, not beside
      // it, so they read as one level down.
      .replace(/^## ([a-z]\)\s*)/gm, "### $1")
      // The proxy leaves a doubled list marker on the payment-details block.
      .replace(/^1\.\s+1\.\s+/gm, "1. ")
      .replace(/^\s+(\d\.)\s+/gm, "$1 ")
      // A heading needs a blank line under it or the paragraph joins it.
      .replace(/^(#{2,3} .+)\n(?=\S)/gm, "$1\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

const entries = [];
const pageRows = [];
for (const page of PAGES) {
  const url = `https://r.jina.ai/${page.source}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`${page.source} 取不到: HTTP ${res.status}`);
  const raw = await res.text();
  if (/returned error 4\d\d/.test(raw)) throw new Error(`${page.source} 返回 404`);
  const body = clean(raw);
  if (body.length < 400) throw new Error(`${page.source} 正文只有 ${body.length} 字，疑似没取全`);

  const contentPath = `pages/legal-${page.slug}.json`;
  const data = {
    // Everything an editor may change lives in `title`, `subtitle` or `intro`,
    // which is what the admin's block editor renders. `meta` is hidden there,
    // so the source address is recorded in it rather than beside the content.
    meta: {
      path: contentPath,
      slug: page.slug,
      section: "legal",
      template: "legal",
      legacyUrl: page.source
    },
    title: page.title,
    subtitle: page.subtitle,
    intro: { updated: page.updated, body }
  };

  const { data: existing } = await s
    .from("cms_content_entries")
    .select("data")
    .eq("path", contentPath)
    .eq("locale", "zh")
    .maybeSingle();

  entries.push({ path: contentPath, before: existing?.data ?? null, after: data });
  pageRows.push({ slug: page.slug, title: page.title });

  console.log(`\n■ ${page.title}  (${contentPath})`);
  console.log(`  正文 ${body.length} 字，${body.split("\n\n").length} 段，${(body.match(/^## /gm) || []).length} 个小标题`);
  console.log("  ---");
  console.log(body.split("\n").map((l) => "  " + l).join("\n"));
}

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `legal-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, entries, pages: pageRows.map((p) => ({ ...p, before: null })) }, null, 2));
console.log(`\n  备份已写入 ${file}`);

for (const e of entries) {
  if (e.before === null) {
    const { error } = await s.from("cms_content_entries").insert({ path: e.path, locale: "zh", data: e.after });
    if (error) throw error;
  } else {
    const { error } = await s
      .from("cms_content_entries")
      .update({ data: e.after })
      .eq("path", e.path)
      .eq("locale", "zh");
    if (error) throw error;
  }
}

for (const p of pageRows) {
  const { data: have } = await s
    .from("cms_pages")
    .select("id")
    .eq("section", "legal")
    .eq("slug", p.slug)
    .eq("locale", "zh")
    .maybeSingle();
  const row = {
    section: "legal",
    slug: p.slug,
    title: p.title,
    template_kind: "legal",
    status: "published",
    locale: "zh"
  };
  const { error } = have
    ? await s.from("cms_pages").update(row).eq("id", have.id)
    : await s.from("cms_pages").insert(row);
  if (error) throw error;
}

console.log(`  已写入 ${entries.length} 个页面，并登记到 cms_pages。`);
console.log(`  撤销：node --env-file=.env.local scripts/import-legal-pages.mjs --restore ${file}`);
