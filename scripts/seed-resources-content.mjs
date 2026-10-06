/**
 * Folds the 资料与出版 pages' heading+body arrays into one Markdown body each.
 *
 * Three pages carried their prose as a list of records -- a heading field and a
 * body field per section, and on the tools page a heading plus an array of
 * paragraphs. The text is DERIVED from what is stored, never retyped, so
 * nothing can be lost in transcription.
 *
 * Nothing is written without `--apply`.
 *
 *   node --env-file=.env.local scripts/seed-resources-content.mjs
 *   node --env-file=.env.local scripts/seed-resources-content.mjs --apply
 *   node --env-file=.env.local scripts/seed-resources-content.mjs --restore backups/resources-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RESTORE = (() => {
  const i = args.indexOf("--restore");
  return i === -1 ? null : args[i + 1];
})();
const LOCALE = "zh";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** `[{heading, body}]` or `[{heading, paragraphs: []}]` -> one markdown body. */
function sectionsToMarkdown(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const heading = String(row?.heading ?? "").trim();
      const paragraphs = Array.isArray(row?.paragraphs)
        ? row.paragraphs.map((p) => String(p).trim()).filter(Boolean)
        : [String(row?.body ?? "").trim()].filter(Boolean);
      const parts = heading ? [`## ${heading}`, ...paragraphs] : paragraphs;
      return parts.join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Which stored key each page's prose comes from.
 *
 * `downloads` is deliberately absent. That page is not rendered by the template
 * at all -- /resources/downloads is served by MaterialsIndexPage, driven by the
 * material categories in 资料管理 -- so its stored `proseSections` appear
 * nowhere, and converting them would have produced a Markdown box that changed
 * nothing on the page.
 */
const SOURCE = {
  magazine: "proseSections",
  tools: "guideSections"
};

const BACKUP_DIR = path.join(process.cwd(), "backups");

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of backup.changes) {
    const { error } = await supabase
      .from("cms_content_entries")
      .update({ data: c.before })
      .eq("locale", LOCALE)
      .eq("path", c.path);
    if (error) throw error;
  }
  console.log(`  已还原 ${backup.changes.length} 个页面（${path.basename(RESTORE)}）`);
  process.exit(0);
}

const { data: rows, error } = await supabase
  .from("cms_content_entries")
  .select("path, data")
  .eq("locale", LOCALE)
  .like("path", "pages/resources-%")
  .order("path");
if (error) throw error;

const changes = [];
for (const row of rows) {
  const slug = row.path.replace("pages/resources-", "").replace(".json", "");
  const sourceKey = SOURCE[slug];
  if (!sourceKey) continue;
  const before = row.data ?? {};
  const body = sectionsToMarkdown(before[sourceKey]);
  if (!body) continue;
  const after = structuredClone(before);
  if (JSON.stringify(after.intro) === JSON.stringify({ body })) continue;
  after.intro = { body };
  changes.push({
    path: row.path,
    before,
    after,
    notes: [`${sourceKey} → intro.body（${body.length} 字）`]
  });
}

console.log(`\n  需要更新 ${changes.length} 个页面\n`);
for (const c of changes) {
  console.log(`    ${c.path}`);
  for (const n of c.notes) console.log(`      · ${n}`);
}

if (changes.length === 0) {
  console.log("  没有需要改的。");
  process.exit(0);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(BACKUP_DIR, `resources-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${path.relative(process.cwd(), file)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

for (const c of changes) {
  const { error: writeError } = await supabase
    .from("cms_content_entries")
    .update({ data: c.after })
    .eq("locale", LOCALE)
    .eq("path", c.path);
  if (writeError) throw writeError;
}
console.log(`  已更新 ${changes.length} 个页面。`);
console.log(
  `  撤销：node --env-file=.env.local scripts/seed-resources-content.mjs --restore ${path.relative(process.cwd(), file)}`
);
