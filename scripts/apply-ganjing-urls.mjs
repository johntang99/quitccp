/**
 * Repoints matched videos from the self-hosted file to Gan Jing World.
 *
 * Reads `docs/implementation/ganjing-matched.csv`, which pairs each of our
 * videos with the same video on the organisation's own Gan Jing World channel.
 * See docs/implementation/videos-to-ganjing.md.
 *
 * Addresses are written in the /embed/ form. Gan Jing World serves its
 * /video/ watch pages with `frame-ancestors 'self' *.ganjing.com`, so a /video/
 * address in an iframe shows nothing; /embed/ carries no such header.
 *
 * Nothing is written without `--apply`.
 *
 *   node scripts/apply-ganjing-urls.mjs                    # dry run, all rows
 *   node scripts/apply-ganjing-urls.mjs --limit 5          # dry run, first 5
 *   node scripts/apply-ganjing-urls.mjs --limit 5 --apply  # write 5
 *   node scripts/apply-ganjing-urls.mjs --exact-only       # skip 疑似 rows
 *   node scripts/apply-ganjing-urls.mjs --restore backups/ganjing-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1];
};
const APPLY = args.includes("--apply");
const EXACT_ONLY = args.includes("--exact-only");
const LIMIT = Number(flag("--limit") ?? "0") || 0;
const RESTORE = flag("--restore");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Defaults to the first matching pass; round two lives in its own file.
const CSV = path.join(process.cwd(), flag("--csv") ?? "docs/implementation/ganjing-matched.csv");
const BACKUP_DIR = path.join(process.cwd(), "backups");

/** Minimal CSV reader: quoted fields, doubled quotes, newlines inside fields. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  let n = 0;
  for (const c of backup.changes) {
    const { error } = await supabase
      .from("cms_videos")
      .update({ source_url: c.before })
      .eq("slug", c.slug);
    if (error) throw error;
    n++;
  }
  console.log(`  已还原 ${n} 条（${path.basename(RESTORE)}）`);
  process.exit(0);
}

const rows = parseCsv(fs.readFileSync(CSV, "utf8").replace(/^﻿/, ""));
const header = rows[0];
const col = (name) => header.indexOf(name);
const iKind = col("匹配方式");
const iTitle = col("标题(我们)");
const iSlug = col("站内slug");
const iUrl = col("干净世界地址");

let entries = rows.slice(1).map((r) => ({
  kind: r[iKind],
  title: r[iTitle],
  slug: r[iSlug],
  // The CSV may hold either form; normalise to /embed/ regardless.
  url: String(r[iUrl]).replace(
    /ganjingworld\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:video|embed|live)\//,
    "ganjingworld.com/embed/"
  )
}));
if (EXACT_ONLY) entries = entries.filter((e) => e.kind === "完全匹配" || e.kind === "自动采用" || e.kind === "同版本-可直接用" || e.kind === "不同剪辑-需决定");
if (LIMIT) entries = entries.slice(0, LIMIT);

console.log(`  CSV 共 ${rows.length - 1} 行，本次处理 ${entries.length} 条`);

// Current values, so the backup is real rather than assumed.
const changes = [];
for (const e of entries) {
  const { data, error } = await supabase
    .from("cms_videos")
    .select("slug, title, source_url")
    .eq("slug", e.slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) { console.log(`  ⚠️ 找不到 slug：${e.slug}`); continue; }
  if (data.source_url === e.url) continue;
  changes.push({ slug: e.slug, title: data.title, before: data.source_url, after: e.url, kind: e.kind });
}

console.log(`  需要改动 ${changes.length} 条\n`);
for (const c of changes.slice(0, LIMIT || 8)) {
  console.log(`    ${c.kind}  ${String(c.title).slice(0, 38)}`);
  console.log(`      旧: ${String(c.before).slice(0, 78)}`);
  console.log(`      新: ${c.after}`);
}

if (changes.length === 0) { console.log("  没有需要改的。"); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(BACKUP_DIR, `ganjing-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${path.relative(process.cwd(), file)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

let done = 0;
for (const c of changes) {
  const { error } = await supabase
    .from("cms_videos")
    .update({ source_url: c.after })
    .eq("slug", c.slug);
  if (error) throw error;
  done++;
}
console.log(`  已更新 ${done} 条。`);
console.log(`  撤销：node scripts/apply-ganjing-urls.mjs --restore ${path.relative(process.cwd(), file)}`);
