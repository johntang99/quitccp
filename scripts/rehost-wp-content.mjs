/**
 * Repoints every `tuidang.org/wp-content/` reference at a new host.
 *
 * When the main domain moves to the new site, `/wp-content/` stops being served
 * by WordPress and several hundred videos and images stop loading. See
 * docs/implementation/domain-transition.md section 2. This rewrites those
 * addresses to wherever the old site keeps serving the files from.
 *
 * Nothing is written without `--apply`. The default is a dry run that prints
 * exactly what would change and writes a backup file, so the diff can be read
 * before anything is touched.
 *
 * Usage:
 *   node scripts/rehost-wp-content.mjs --to https://legacy.tuidang.org
 *   node scripts/rehost-wp-content.mjs --to https://legacy.tuidang.org --apply
 *   node scripts/rehost-wp-content.mjs --restore backups/rehost-<stamp>.json
 *
 * The backup records the previous value of every field it changes, so
 * `--restore` puts them all back exactly as they were.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? "";
};
const APPLY = args.includes("--apply");
const RESTORE = flag("--restore");
const TO = (flag("--to") || "").replace(/\/$/, "");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Which columns carry addresses. Kept explicit rather than scanning every text
 * column: a blind search-and-replace across a CMS is how you discover later
 * that it rewrote something inside an article quotation.
 */
const TARGETS = [
  { table: "cms_videos", columns: ["source_url", "cover_image", "body_markdown", "description"] },
  // cms_articles is scanned a year at a time. An unqualified
  // `body_plain ilike '%...%'` over 15,515 rows and ~120MB of prose exceeds the
  // 8s statement timeout; a single year is roughly 600ms. (The trigram index
  // that would have made this fast was dropped in migration 021 because it made
  // every write to the table fail.)
  { table: "cms_articles", columns: ["hero_image", "body_plain", "summary"], chunkBy: "published_at" },
  { table: "cms_materials", columns: ["cover_image", "body_markdown", "summary"] }
];

/** Years covered by the archive, oldest first. */
const YEARS = Array.from({ length: new Date().getFullYear() - 2001 }, (_, i) => 2002 + i);

// Both hosts appear in the data; `www.` is the common one.
const PATTERN = /https?:\/\/(?:www\.)?tuidang\.org\/wp-content\//g;

const BACKUP_DIR = path.join(process.cwd(), "backups");

/**
 * Retries a write that failed for a reason worth retrying.
 *
 * `57014` is Postgres cancelling a statement that hit the timeout. It showed up
 * partway through a 289-row run even though a single article update measures
 * ~170ms, so it is load, not size -- exactly the kind of failure that succeeds
 * on a second attempt. Crashing instead would leave the data half-rewritten on
 * cutover day, which is the worst moment for it.
 */
const TRANSIENT = new Set(["57014", "40001", "08006", "08003"]);

async function withRetry(run, label) {
  let delay = 400;
  for (let attempt = 1; ; attempt++) {
    const { error } = await run();
    if (!error) return null;
    if (!TRANSIENT.has(error.code) || attempt >= 4) return error;
    process.stdout.write(`\n  retrying ${label} after ${error.code} (attempt ${attempt + 1})…`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
}

async function readSlice(table, columns, select, filter, narrow) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    let query = supabase.from(table).select(select).or(filter);
    if (narrow) query = narrow(query);
    const { data, error } = await query.range(from, from + 499);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}

async function readAll(table, columns, chunkBy) {
  const select = ["id", ...columns].join(", ");
  // One pass per column would re-read the table; a single OR covers them all.
  const filter = columns.map((c) => `${c}.ilike.%tuidang.org/wp-content/%`).join(",");

  if (!chunkBy) return readSlice(table, columns, select, filter);

  const rows = [];
  for (const year of YEARS) {
    const slice = await readSlice(table, columns, select, filter, (q) =>
      q.gte(chunkBy, `${year}-01-01`).lt(chunkBy, `${year + 1}-01-01`)
    );
    rows.push(...slice);
    process.stdout.write(`\r  scanning ${table} ${year}… ${rows.length} found   `);
  }
  // Anything undated would be skipped by the year loop, so it is swept up here.
  const undated = await readSlice(table, columns, select, filter, (q) => q.is(chunkBy, null));
  rows.push(...undated);
  process.stdout.write(`\r  scanned ${table}: ${rows.length} rows found            \n`);
  return rows;
}

async function restore(file) {
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  const failed = [];
  for (const entry of backup.changes) {
    const error = await withRetry(
      () => supabase.from(entry.table).update(entry.before).eq("id", entry.id),
      `${entry.table}/${entry.id}`
    );
    if (error) failed.push({ ...entry, error: error.message });
    else n++;
    if (n % 50 === 0) process.stdout.write(`\r  restored ${n}/${backup.changes.length}   `);
  }
  console.log(`\n  restored ${n} rows from ${path.basename(file)}`);
  if (failed.length > 0) {
    // The file is left intact, so re-running --restore retries only what is
    // still wrong: putting a value back that is already correct is a no-op.
    console.log(`  ${failed.length} rows could NOT be restored -- re-run --restore on the same file.`);
    for (const f of failed.slice(0, 5)) console.log(`    ${f.table}/${f.id}: ${f.error}`);
    process.exitCode = 1;
  }
}

if (RESTORE) {
  await restore(RESTORE);
  process.exit(0);
}

if (!TO) {
  console.error("  --to <https://new-host> is required (or --restore <backup file>)");
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9.-]+$/i.test(TO)) {
  console.error(`  --to must be a plain https origin, got: ${TO}`);
  process.exit(1);
}

const changes = [];
const samples = [];
let fields = 0;

for (const { table, columns } of TARGETS) {
  let rows;
  try {
    rows = await readAll(table, columns, TARGETS.find((t) => t.table === table)?.chunkBy);
  } catch (error) {
    // A column that does not exist on this table is not worth stopping for.
    console.log(`  (skipped ${table}: ${error.message})`);
    continue;
  }
  for (const row of rows) {
    const before = {};
    const after = {};
    for (const column of columns) {
      const value = row[column];
      if (typeof value !== "string" || !PATTERN.test(value)) {
        PATTERN.lastIndex = 0;
        continue;
      }
      PATTERN.lastIndex = 0;
      const replaced = value.replace(PATTERN, `${TO}/wp-content/`);
      if (replaced === value) continue;
      before[column] = value;
      after[column] = replaced;
      fields++;
      if (samples.length < 6) {
        const hit = value.match(PATTERN)?.[0] ?? "";
        PATTERN.lastIndex = 0;
        samples.push(`${table}.${column}: ${hit} -> ${TO}/wp-content/`);
      }
    }
    if (Object.keys(after).length > 0) {
      changes.push({ table, id: row.id, before, after });
    }
  }
}

console.log(`\n  rows to change:   ${changes.length}`);
console.log(`  fields to change: ${fields}`);
const byTable = {};
for (const c of changes) byTable[c.table] = (byTable[c.table] ?? 0) + 1;
for (const [table, n] of Object.entries(byTable)) console.log(`    ${table.padEnd(16)} ${n}`);
console.log("\n  samples:");
for (const s of samples) console.log(`    ${s}`);

if (changes.length === 0) {
  console.log("\n  nothing to do.");
  process.exit(0);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(BACKUP_DIR, `rehost-${stamp}.json`);
// Written before any update, not after: a run that times out half way through
// must still leave a file that can put everything back.
fs.writeFileSync(backupFile, JSON.stringify({ to: TO, at: stamp, changes }, null, 2));
console.log(`\n  backup written: ${path.relative(process.cwd(), backupFile)}`);

if (!APPLY) {
  console.log("\n  DRY RUN -- nothing written. Re-run with --apply to make these changes.");
  process.exit(0);
}

let done = 0;
const failures = [];
for (const entry of changes) {
  const error = await withRetry(
    () => supabase.from(entry.table).update(entry.after).eq("id", entry.id),
    `${entry.table}/${entry.id}`
  );
  if (error) failures.push({ table: entry.table, id: entry.id, error: error.message });
  else done++;
  if (done % 25 === 0) process.stdout.write(`\r  updated ${done}/${changes.length}   `);
}
console.log(`\n  updated ${done} rows.`);
if (failures.length > 0) {
  console.log(`  ${failures.length} rows FAILED:`);
  for (const f of failures.slice(0, 10)) console.log(`    ${f.table}/${f.id}: ${f.error}`);
  console.log("  Re-run the same command -- rows already rewritten will simply match and be skipped.");
  process.exitCode = 1;
}
console.log(`  to undo: node scripts/rehost-wp-content.mjs --restore ${path.relative(process.cwd(), backupFile)}`);
