/**
 * Imports the harvested FAQ into `cms_faq_categories` and `cms_faqs`.
 *
 * Reads what `scripts/harvest-faq.ts` wrote. Matches on `legacy_id`, so running
 * it again after a fresh harvest updates the answers rather than duplicating
 * them -- and leaves alone anything an editor has written here since.
 *
 * Nothing is written without `--apply`.
 *
 *   npx tsx scripts/harvest-faq.ts
 *   node --env-file=.env.local scripts/import-faq.mjs
 *   node --env-file=.env.local scripts/import-faq.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const FILE = "artifacts/faq/faq.json";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!fs.existsSync(FILE)) {
  console.error(`  找不到 ${FILE}，请先跑 npx tsx scripts/harvest-faq.ts`);
  process.exit(1);
}
const harvest = JSON.parse(fs.readFileSync(FILE, "utf8"));

// Fail early and clearly if the migration has not been run.
const probe = await s.from("cms_faqs").select("id").limit(1);
if (probe.error) {
  console.error("\n  cms_faqs 表不存在。请先在 Supabase SQL Editor 执行：");
  console.error("    supabase/content/migrations/023_faq.sql\n");
  console.error(`  （错误：${probe.error.message}）`);
  process.exit(1);
}

/** The order the old hub shows: newest first inside a category. */
const items = [...harvest.items].sort(
  (a, b) => a.categorySlug.localeCompare(b.categorySlug) || b.publishedAt.localeCompare(a.publishedAt)
);

console.log(`\n  分类 ${harvest.categories.length} 个，问答 ${items.length} 条`);
if (!APPLY) {
  for (const c of harvest.categories) console.log(`    ${c.slug.padEnd(10)} ${c.name}  ${c.count} 条`);
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

// ---------------------------------------------------------------- categories
const categoryId = new Map();
for (const [index, c] of harvest.categories.entries()) {
  const { data: existing } = await s.from("cms_faq_categories").select("id").eq("slug", c.slug).maybeSingle();
  if (existing) {
    categoryId.set(c.slug, existing.id);
    continue;
  }
  const { data, error } = await s
    .from("cms_faq_categories")
    .insert({ slug: c.slug, name: c.name, summary: c.description ?? "", sort_order: index })
    .select("id")
    .single();
  if (error) throw error;
  categoryId.set(c.slug, data.id);
}
console.log(`  分类就绪 ${categoryId.size} 个`);

// --------------------------------------------------------------------- items
const { data: known } = await s.from("cms_faqs").select("id, legacy_id").not("legacy_id", "is", null);
const byLegacy = new Map((known ?? []).map((r) => [Number(r.legacy_id), r.id]));

let created = 0;
let updated = 0;
const positions = new Map();
for (const item of items) {
  const position = positions.get(item.categorySlug) ?? 0;
  positions.set(item.categorySlug, position + 1);

  const row = {
    slug: item.slug,
    locale: "zh",
    question: item.question,
    answer_markdown: item.answerMarkdown,
    category_id: categoryId.get(item.categorySlug) ?? null,
    position,
    // Imported answers go live: they are already public on the old site, and
    // leaving 45 drafts behind would mean the page launches empty.
    status: "published",
    legacy_id: item.legacyId,
    legacy_url: item.legacyUrl,
    updated_by: "import@quitccp.local"
  };

  const existingId = byLegacy.get(item.legacyId);
  if (existingId) {
    const { error } = await s.from("cms_faqs").update(row).eq("id", existingId);
    if (error) throw error;
    updated += 1;
  } else {
    const { error } = await s.from("cms_faqs").insert({ ...row, created_by: "import@quitccp.local" });
    if (error) throw error;
    created += 1;
  }
}

console.log(`  新增 ${created} 条，更新 ${updated} 条`);
console.log("  完成。");
