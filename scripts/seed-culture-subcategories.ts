/**
 * Gives 中华传统文化 two real sub-categories: 诗词 and 歌曲.
 *
 *   npx tsx scripts/seed-culture-subcategories.ts --dry-run
 *   npx tsx scripts/seed-culture-subcategories.ts --apply
 *
 * The culture page used to offer five filters -- 传统故事, 历史人物, 诗词,
 * 节气与民俗, 良言善语 -- none of which existed as data. They were implemented
 * by matching article titles against hardcoded names (`title.includes("乌台")`,
 * `title.includes("仓颉")`), and 良言善语 simply returned 诗词 articles, so two
 * different chips gave identical results.
 *
 * This replaces that with membership an editor can see and change: the filters
 * become categories, so the article admin manages them like any other.
 *
 * ## Siblings, not parent and child
 *
 * The three are peers -- 传统文化文章, 诗词, 歌曲 -- and every article belongs to
 * exactly one. The obvious alternative, keeping 中华传统文化 as a parent and
 * adding 诗词 as a second membership, cannot work with this admin: saving an
 * article deletes all of its category rows and re-inserts only what the form
 * sends, and the form has a single 主分类 select. An editor opening a poem and
 * pressing save would silently drop it back to the parent, with no way to put
 * it back. One primary category per article is what the admin can express, so
 * that is what the data says.
 *
 * The page's 全部 is the union of the three, so nothing is lost by the split.
 *
 * ## The classification is a seed, not an authority
 *
 * Titles on this site are unusually regular -- 诗词：…, 男声独唱：…, 乐曲：… --
 * so a title rule files most of them correctly on the first pass. It will still
 * be wrong at the edges (a 对联 is not quite a poem; 二胡 is music without
 * saying so). That is expected: the point is to get 314 articles filed well
 * enough to be useful, then let editors correct them one at a time.
 *
 * Re-running is safe: it only adds missing memberships and never removes an
 * assignment an editor has made.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFileIfPresent(filePath: string) {
  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // optional
  }
}

/** Sung or played: the title names a voice or an instrument. */
const SONG =
  /(独唱|合唱|齐唱|对唱|重唱|歌曲|乐曲|演奏|独奏|歌[：:]|二胡|琵琶|古筝|笛子|洞箫|小提琴|钢琴|古琴|扬琴)/;

/** Written verse: the title names a form. */
const POEM =
  /^(诗词|诗歌|藏头诗|七绝|七律|五绝|五律|绝句|律诗|对联|小篆对联|顺口溜|打油诗|词)[：:　\s]|^对联$|诗词[：:]|^诗[：:]/;

export function classify(title: string): "song" | "poem" | null {
  if (SONG.test(title)) return "song";
  if (POEM.test(title)) return "poem";
  return null;
}

const SUBCATEGORIES = [
  { slug: "culture-poetry", name: "诗词", sortOrder: 1, kind: "poem" as const },
  { slug: "culture-music", name: "歌曲", sortOrder: 2, kind: "song" as const }
];

/** The leftover bucket keeps the slug `culture`; only its label changes. */
const PLAIN_NAME = "传统文化文章";

async function main() {
  loadEnvFileIfPresent(resolve(process.cwd(), ".env.local"));
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: parent, error: parentError } = await supabase
    .from("cms_article_categories")
    .select("id")
    .eq("slug", "culture")
    .maybeSingle();
  if (parentError) throw parentError;
  if (!parent) throw new Error("No 'culture' category");

  // Make sure both sub-categories exist.
  const ids = new Map<string, string>();
  for (const sub of SUBCATEGORIES) {
    const { data: existing } = await supabase
      .from("cms_article_categories")
      .select("id")
      .eq("slug", sub.slug)
      .maybeSingle();
    if (existing) {
      ids.set(sub.kind, String(existing.id));
      console.log(`category ${sub.name} (${sub.slug}) already exists`);
      continue;
    }
    if (!apply) {
      console.log(`would create category ${sub.name} (${sub.slug})`);
      continue;
    }
    const { data: created, error } = await supabase
      .from("cms_article_categories")
      .insert({ slug: sub.slug, name: sub.name, sort_order: sub.sortOrder })
      .select("id")
      .single();
    if (error) throw error;
    ids.set(sub.kind, String(created.id));
    console.log(`created category ${sub.name} (${sub.slug})`);
  }

  // Every published article under 中华传统文化.
  const { data: rows, error } = await supabase
    .from("cms_article_category_map")
    .select("article_id, cms_articles!inner(id, title, status)")
    .eq("category_id", parent.id)
    .eq("cms_articles.status", "published")
    .limit(2000);
  if (error) throw error;

  const articles = (rows ?? []).map((row) => {
    const a = (row as { cms_articles: { id: string; title: string } }).cms_articles;
    return { id: String(a.id), title: String(a.title) };
  });

  const counts = { poem: 0, song: 0, plain: 0 };
  const pending: { article_id: string; category_id: string; position: number }[] = [];
  const moved: string[] = [];

  for (const article of articles) {
    const kind = classify(article.title);
    if (!kind) {
      counts.plain += 1;
      continue;
    }
    counts[kind] += 1;
    const categoryId = ids.get(kind);
    if (categoryId) {
      // position 0: this becomes the article's primary -- and only -- category,
      // which is the one thing the admin's single select can edit.
      pending.push({ article_id: article.id, category_id: categoryId, position: 0 });
      moved.push(article.id);
    }
  }

  console.log(
    `\n${articles.length} published culture articles -> 诗词 ${counts.poem}, 歌曲 ${counts.song}, 其余文章 ${counts.plain}`
  );
  console.log("\nexamples:");
  for (const kind of ["poem", "song"] as const) {
    const sample = articles.filter((a) => classify(a.title) === kind).slice(0, 4);
    console.log(`  ${kind === "poem" ? "诗词" : "歌曲"}: ${sample.map((a) => a.title.slice(0, 18)).join(" / ")}`);
  }

  if (!apply) {
    console.log("\n--dry-run: nothing written (pass --apply)");
    return;
  }

  // The leftover bucket is relabelled; its slug and its articles stay put.
  const { error: renameError } = await supabase
    .from("cms_article_categories")
    .update({ name: PLAIN_NAME })
    .eq("slug", "culture");
  if (renameError) throw renameError;
  console.log(`\nrenamed 中华传统文化 -> ${PLAIN_NAME} (slug unchanged)`);

  // upsert, so a re-run never duplicates and never clears an editor's own work.
  for (let i = 0; i < pending.length; i += 200) {
    const chunk = pending.slice(i, i + 200);
    const { error: mapError } = await supabase
      .from("cms_article_category_map")
      .upsert(chunk, { onConflict: "article_id,category_id" });
    if (mapError) throw mapError;
  }

  // Each moved article now sits in exactly one category, so the admin's single
  // select tells the whole truth about it.
  for (let i = 0; i < moved.length; i += 100) {
    const chunk = moved.slice(i, i + 100);
    const { error: dropError } = await supabase
      .from("cms_article_category_map")
      .delete()
      .in("article_id", chunk)
      .eq("category_id", parent.id);
    if (dropError) throw dropError;
  }
  console.log(`applied: ${pending.length} membership(s); ${moved.length} moved out of the leftover bucket`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
