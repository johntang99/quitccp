/**
 * Moves the 参与支持 pages' content out of the templates and into the CMS.
 *
 * Almost everything these five pages showed was written into the template --
 * the donation panel, the spending figures, the volunteer roles, the ENDCCP
 * prose, every sidebar. The JSON an editor could actually open held a title, a
 * subtitle, and two keys (`cards`, `sidebar`) that rendered nowhere.
 *
 * This writes those same words into the content entries, in the shape the new
 * block editor declares, and drops the two dead keys. The templates fall back
 * to the identical defaults, so a page whose entry is missing a block looks the
 * same as before.
 *
 * Existing values are never overwritten: a key already present in the entry is
 * left exactly as the editor left it. Nothing is written without `--apply`.
 *
 *   node --env-file=.env.local scripts/seed-involve-content.mjs
 *   node --env-file=.env.local scripts/seed-involve-content.mjs --apply
 *   node --env-file=.env.local scripts/seed-involve-content.mjs --restore backups/involve-<stamp>.json
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

/**
 * The content itself lives in the schema package, which is also what a fresh
 * install seeds from and what the templates fall back to. Importing it keeps
 * one copy: a second literal here would drift the moment either side changed.
 */
const { involvePageDefaults } = await import("../packages/content-schema/src/involve-content.ts");

/** Keys that were prototype boilerplate: no involve template ever read them. */
const DROP_KEYS = ["cards", "sidebar", "steps", "fields", "notice"];

const SEEDS = Object.fromEntries(
  Object.entries(involvePageDefaults).map(([slug, data]) => [`pages/involve-${slug}.json`, data])
);

const BACKUP_DIR = path.join(process.cwd(), "backups");

async function readEntry(p) {
  const { data, error } = await supabase
    .from("cms_content_entries")
    .select("path, data")
    .eq("locale", LOCALE)
    .eq("path", p)
    .maybeSingle();
  if (error) throw error;
  return data;
}

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

const changes = [];
for (const [p, seed] of Object.entries(SEEDS)) {
  const row = await readEntry(p);
  if (!row) {
    console.log(`  ⚠️ 找不到内容条目：${p}`);
    continue;
  }
  const before = row.data ?? {};
  const after = { ...before };
  const added = [];
  const dropped = [];
  for (const [key, value] of Object.entries(seed)) {
    // An editor's own value always wins; this only fills what is absent.
    if (after[key] !== undefined) continue;
    after[key] = structuredClone(value);
    added.push(key);
  }
  for (const key of DROP_KEYS) {
    if (after[key] === undefined) continue;
    delete after[key];
    dropped.push(key);
  }
  if (added.length === 0 && dropped.length === 0) continue;
  changes.push({ path: p, before, after, added, dropped });
}

console.log(`\n  需要更新 ${changes.length} 个页面\n`);
for (const c of changes) {
  console.log(`    ${c.path}`);
  if (c.added.length) console.log(`      新增区块: ${c.added.join(", ")}`);
  if (c.dropped.length) console.log(`      删除无用键: ${c.dropped.join(", ")}`);
}

if (changes.length === 0) {
  console.log("  没有需要改的。");
  process.exit(0);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(BACKUP_DIR, `involve-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${path.relative(process.cwd(), file)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

for (const c of changes) {
  const { error } = await supabase
    .from("cms_content_entries")
    .update({ data: c.after })
    .eq("locale", LOCALE)
    .eq("path", c.path);
  if (error) throw error;
}
console.log(`  已更新 ${changes.length} 个页面。`);
console.log(`  撤销：node --env-file=.env.local scripts/seed-involve-content.mjs --restore ${path.relative(process.cwd(), file)}`);
