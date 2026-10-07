/**
 * Repoints stored links to old-site article permalinks at our own articles.
 *
 * The homepage cards and the video pages' featured / episode / grid rows still
 * link to `www.tuidang.org/2020/08/04/747/`. All of those articles were
 * imported, so the links leave the site for pages we hold -- and after the
 * cutover that domain is this site, so they stop resolving entirely.
 *
 * Rewritten to `/news/a/<id>`, which redirects to the article's current
 * address. The id is the old post id and never changes; an article's slug is
 * its Chinese title, so retitling one in the admin would break a direct link.
 *
 * This only rewrites link addresses. It does not touch the news section's
 * article loading, which reads from the database, nor any page's wording.
 *
 *   node --env-file=.env.local scripts/relink-article-links.mjs
 *   node --env-file=.env.local scripts/relink-article-links.mjs --apply
 *   node --env-file=.env.local scripts/relink-article-links.mjs --restore backups/article-links-<stamp>.json
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

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of backup.changes) {
    const { error } = await s.from("cms_content_entries").update({ data: c.before }).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.changes.length} 个页面`);
  process.exit(0);
}

// Inside jsonb the slashes come back escaped, so both spellings are matched.
const PERMALINK = /https?:\\?\/\\?\/(?:www\.)?tuidang\.org\\?\/\d{4}\\?\/\d{2}\\?\/\d{2}\\?\/(\d+)\\?\/?/g;

const { data: rows, error } = await s.from("cms_content_entries").select("id, path, data").eq("locale", "zh");
if (error) throw error;

// Which of those posts we actually hold. Anything else keeps its old address:
// a link to an article we never imported is better left pointing somewhere.
const wanted = new Set();
for (const row of rows ?? []) {
  for (const m of JSON.stringify(row.data ?? {}).matchAll(PERMALINK)) wanted.add(Number(m[1]));
}
const { data: arts, error: artError } = await s
  .from("cms_articles")
  .select("legacy_id, title")
  .in("legacy_id", [...wanted]);
if (artError) throw artError;
const held = new Map(arts.map((a) => [Number(a.legacy_id), a.title]));
console.log(`\n  链接涉及 ${wanted.size} 篇老站文章，我们收录了 ${held.size} 篇`);

const changes = [];
let rewritten = 0;
const missing = new Set();
for (const row of rows ?? []) {
  const before = JSON.stringify(row.data ?? {});
  const after = before.replace(PERMALINK, (whole, id) => {
    if (!held.has(Number(id))) {
      missing.add(id);
      return whole;
    }
    rewritten += 1;
    return `/news/a/${id}`;
  });
  if (after === before) continue;
  changes.push({ id: row.id, path: row.path, before: row.data, after: JSON.parse(after) });
}

console.log(`  改写 ${rewritten} 处，分布在 ${changes.length} 个页面`);
for (const c of changes) console.log(`    ${c.path}`);
if (missing.size) console.log(`  ${missing.size} 篇未收录，保持原样: ${[...missing].join(", ")}`);

if (changes.length === 0) process.exit(0);
if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `article-links-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${file}`);

for (const c of changes) {
  const { error: e } = await s.from("cms_content_entries").update({ data: c.after }).eq("id", c.id);
  if (e) throw e;
}
console.log(`  已更新 ${changes.length} 个页面。`);
console.log(`  撤销：node --env-file=.env.local scripts/relink-article-links.mjs --restore ${file}`);
