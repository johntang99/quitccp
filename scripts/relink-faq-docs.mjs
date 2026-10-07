/**
 * Repoints stored `/docs/<id>/` links at the FAQ this site now holds.
 *
 * Every one of the old site's 17 FAQ documents was imported into `cms_faqs`, so
 * a link to `www.tuidang.org/docs/694368/` sends a reader away for an answer
 * that is already here -- and after the cutover that address stops resolving.
 *
 * Rewritten to `/services/faq/d/<id>`, which redirects to the question's
 * current address: the slug is the question text, so an editor rewording one
 * must not break the links pointing at it.
 *
 * Only ids we actually hold are rewritten; anything else is left alone.
 *
 *   node --env-file=.env.local scripts/relink-faq-docs.mjs
 *   node --env-file=.env.local scripts/relink-faq-docs.mjs --apply
 *   node --env-file=.env.local scripts/relink-faq-docs.mjs --restore backups/faq-docs-<stamp>.json
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

const { data: faqs } = await s.from("cms_faqs").select("legacy_id").not("legacy_id", "is", null);
const known = new Set((faqs ?? []).map((r) => Number(r.legacy_id)));
console.log(`\n  我们持有的问答 ${known.size} 条`);

// Inside jsonb the slashes come back escaped, so both spellings are matched.
const DOC = /https?:\\?\/\\?\/(?:www\.)?tuidang\.org\\?\/docs\\?\/(\d+)\\?\/?/g;

const { data: rows, error } = await s.from("cms_content_entries").select("id, path, data").eq("locale", "zh");
if (error) throw error;

const changes = [];
let rewritten = 0;
let skipped = 0;
for (const row of rows ?? []) {
  const before = JSON.stringify(row.data ?? {});
  const after = before.replace(DOC, (whole, id) => {
    if (!known.has(Number(id))) {
      skipped += 1;
      return whole;
    }
    rewritten += 1;
    return `/services/faq/d/${id}`;
  });
  if (after === before) continue;
  changes.push({ id: row.id, path: row.path, before: row.data, after: JSON.parse(after) });
}

console.log(`  改写 ${rewritten} 处，保留 ${skipped} 处（不在我们的问答库里）`);
for (const c of changes) console.log(`    ${c.path}`);

if (changes.length === 0) process.exit(0);
if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `faq-docs-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${file}`);

for (const c of changes) {
  const { error: e } = await s.from("cms_content_entries").update({ data: c.after }).eq("id", c.id);
  if (e) throw e;
}
console.log(`  已更新 ${changes.length} 个页面。`);
console.log(`  撤销：node --env-file=.env.local scripts/relink-faq-docs.mjs --restore ${file}`);
