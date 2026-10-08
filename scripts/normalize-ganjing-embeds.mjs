/**
 * Rewrites stored 干净世界 addresses to the /embed/ form.
 *
 * Nothing is broken right now: the site converts these when it renders, so all
 * 11 play for readers today. This is tidying -- it makes what is stored match
 * what the admin now produces, so the next person reading the database is not
 * left wondering which form is correct.
 *
 * Both the /video/ and /live/ paths are converted. Checked against the site
 * first: the live id answers 200 under /embed/ with the right title, and the
 * short legacy ids (V4ByxZ6n2Svyy) redirect to their long form under /embed/
 * exactly as they do under /video/.
 *
 *   node --env-file=.env.local scripts/normalize-ganjing-embeds.mjs
 *   node --env-file=.env.local scripts/normalize-ganjing-embeds.mjs --apply
 *   node --env-file=.env.local scripts/normalize-ganjing-embeds.mjs --restore backups/gjw-embed-<stamp>.json
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
  const b = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of b.changes) {
    const { error } = await s
      .from(c.table)
      .update({ [c.column]: c.before })
      .eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${b.changes.length} 处`);
  process.exit(0);
}

/** Every /video/ or /live/ address, wherever it appears in a string. */
const WATCH_GLOBAL = /https?:\/\/(?:www\.)?ganjingworld\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:video|live)\/([A-Za-z0-9]+)/gi;

/** In prose: rewrite each address where it stands, leave the words alone. */
const toEmbedInText = (text) =>
  String(text ?? "").replace(WATCH_GLOBAL, (_m, id) => `https://www.ganjingworld.com/embed/${id}`);

/**
 * In an address column: a bare embed address, but only where there is a problem.
 *
 * Deliberately narrow. An earlier version normalised every address column and
 * proposed stripping `?feature=oembed` from 533 YouTube URLs that play
 * perfectly -- a large rewrite of working data, well outside the point of this
 * script. So a field is touched only when it is one of the two things actually
 * wrong:
 *
 * - a 干净世界 /video/ or /live/ address, which is the whole subject here; or
 * - an address with prose pasted in after it (2 rows), which plays today only
 *   because the renderer picks the id out by regex.
 *
 * Everything else is left exactly as it is.
 */
function toEmbedField(value) {
  const text = String(value ?? "").trim();
  const contaminated = /\s/.test(text) || /[一-鿿]/.test(text);
  const ganjingWatch = /ganjingworld\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:video|live)\//i.test(text);
  if (!contaminated && !ganjingWatch) return text;

  const ganjing = text.match(
    /https?:\/\/(?:www\.)?ganjingworld\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:video|embed|live)\/([A-Za-z0-9]+)/i
  );
  if (ganjing) return `https://www.ganjingworld.com/embed/${ganjing[1]}`;
  const youtube =
    text.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/) ??
    text.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/) ??
    text.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  return text;
}

async function all(table, columns) {
  let rows = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await s.from(table).select(columns).range(page * 500, page * 500 + 499);
    if (error) throw error;
    rows = rows.concat(data ?? []);
    if (!data || data.length < 500) break;
  }
  return rows;
}

const TARGETS = [
  { table: "cms_videos", columns: "id,slug,title,source_url,backup_url,body_markdown", fields: ["source_url", "backup_url", "body_markdown"] },
  { table: "cms_articles", columns: "id,slug,title,body_markdown", fields: ["body_markdown"] },
  { table: "cms_materials", columns: "id,slug,title,body_markdown", fields: ["body_markdown"] }
];

const changes = [];
for (const target of TARGETS) {
  const rows = await all(target.table, target.columns);
  for (const row of rows) {
    for (const field of target.fields) {
      const before = row[field];
      if (!before) continue;
      const after = field === "body_markdown" ? toEmbedInText(before) : toEmbedField(before);
      if (after === before) continue;
      changes.push({ table: target.table, column: field, id: row.id, slug: row.slug, title: row.title, before, after });
    }
  }
  console.log(`  扫描 ${target.table}：${rows.length} 行`);
}

console.log(`\n=== 要改的 ${changes.length} 处 ===\n`);
for (const c of changes) {
  const label = c.column === "body_markdown" ? "正文" : c.column === "source_url" ? "播放地址" : "备用地址";
  console.log(`  ${c.table.replace("cms_", "")} ${label}  ${String(c.title).slice(0, 34)}`);
  if (c.column === "body_markdown") {
    // Bodies are long; show only the addresses that change.
    const was = [...String(c.before).matchAll(WATCH_GLOBAL)].map((m) => m[0]);
    for (const u of was) console.log(`     ${u}\n      → ${toEmbedInText(u)}`);
  } else {
    console.log(`     ${String(c.before).slice(0, 120)}${String(c.before).length > 120 ? "…" : ""}`);
    console.log(`      → ${c.after}`);
  }
  console.log("");
}

if (changes.length === 0) process.exit(0);

if (!APPLY) {
  console.log("  空跑 —— 没有写入。确认后加 --apply。");
  console.log("  （不改也不会坏：页面渲染时本来就会自动转成 /embed/。）");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), changes };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `gjw-embed-${backup.at.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify(backup, null, 2));

for (const c of changes) {
  const { error } = await s
    .from(c.table)
    .update({ [c.column]: c.after })
    .eq("id", c.id);
  if (error) throw error;
}
console.log(`  已改 ${changes.length} 处`);
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/normalize-ganjing-embeds.mjs --restore ${file}`);
