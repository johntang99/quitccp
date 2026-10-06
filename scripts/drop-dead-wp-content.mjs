/**
 * Removes references to files that no longer exist on the old WordPress site.
 *
 * `rehost-media-to-storage.mjs` moved everything that could still be fetched
 * into our own storage. What it could not fetch is listed in
 * docs/implementation/wp-content-unreachable.csv: files the old server answers
 * 404 for (deleted) and files Cloudflare blocks (403). Both render as a broken
 * image or a dead link on the live site today.
 *
 * This strips those references out. It removes the markup, not the article:
 *
 *   `![](dead.jpg)`                      -> removed
 *   `[text](dead.mp4)`                   -> removed, label included
 *   `[audio mp3="dead.mp3"][/audio]]]`   -> removed (WordPress shortcode left
 *                                           by the import; it renders as
 *                                           literal text either way)
 *   a bare address in the text           -> removed
 *   `hero_image` pointing at a dead file -> cleared
 *
 * Surrounding prose is never touched. Every link being removed was checked
 * first: all of them are either a naked address used as its own label, or a
 * download button ("下载（19MB)") that has nothing left to download.
 *
 * `cms_videos.source_url` is deliberately NOT touched -- those 19 videos are
 * being uploaded to Gan Jing World and will get a new address, not a deletion.
 *
 * Nothing is written without `--apply`.
 *
 *   node --env-file=.env.local scripts/drop-dead-wp-content.mjs
 *   node --env-file=.env.local scripts/drop-dead-wp-content.mjs --apply
 *   node --env-file=.env.local scripts/drop-dead-wp-content.mjs --restore backups/drop-dead-<stamp>.json
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CSV = path.join(process.cwd(), "docs/implementation/wp-content-unreachable.csv");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const YEARS = Array.from({ length: new Date().getFullYear() - 2001 }, (_, i) => 2002 + i);
const TRANSIENT = new Set(["57014", "40001", "08006", "08003"]);

const esc = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function withRetry(run, label) {
  let delay = 400;
  for (let attempt = 1; ; attempt++) {
    const { error } = await run();
    if (!error) return null;
    if (!TRANSIENT.has(error.code) || attempt >= 4) return error;
    process.stdout.write(`\n  ${label} 遇到 ${error.code}，第 ${attempt + 1} 次重试…`);
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }
}

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  let n = 0;
  for (const entry of backup.changes) {
    const error = await withRetry(
      () => supabase.from(entry.table).update(entry.before).eq("id", entry.id),
      `${entry.table}/${entry.id}`
    );
    if (!error) n++;
  }
  console.log(`  已还原 ${n}/${backup.changes.length} 行（${path.basename(RESTORE)}）`);
  process.exit(0);
}

// The CSV is the authority on what is dead -- it was produced by actually
// requesting every address, not by guessing from the extension.
const dead = fs
  .readFileSync(CSV, "utf8")
  .split("\n")
  .slice(1)
  .map((line) => line.match(/^"([^"]+)"/)?.[1])
  .filter(Boolean);
console.log(`\n  失效地址 ${dead.length} 个（来自 ${path.relative(process.cwd(), CSV)}）\n`);

/** Strips every reference to one dead address out of a markdown body. */
function stripFrom(text, url) {
  const u = esc(url);
  return text
    // WordPress audio/video shortcodes left by the import.
    .replace(new RegExp(`\\[(?:audio|video)[^\\]]*${u}[^\\]]*\\](?:\\[/(?:audio|video)\\])?\\]*`, "gi"), "")
    // Images, then links. The label goes too: every one of them is either the
    // address itself or a download button with nothing behind it.
    .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*${u}[^)]*\\)`, "g"), "")
    .replace(new RegExp(`\\[[^\\]]*\\]\\(\\s*${u}[^)]*\\)`, "g"), "")
    // Anything left over: a bare address in the prose.
    .replace(new RegExp(u + `[^\\s"'<>)\\]]*`, "g"), "");
}

/** Removes the markup, then tidies the holes it left behind. */
function clean(text) {
  return text
    .split("\n")
    // A line that held only an image is now empty -- drop it rather than leave
    // a blank line where the picture was.
    .map((line) => (line.trim() === "" ? "" : line.replace(/[ \t]+$/, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Page content is one jsonb column, handled separately below -- the homepage
 * cards and listing thumbnails live there, not in a text column.
 */
const JSON_TARGET = { table: "cms_content_entries", column: "data" };

const TARGETS = [
  { table: "cms_articles", columns: ["body_markdown", "body_plain", "summary"], clears: ["hero_image"], chunkBy: "published_at" },
  // `source_url` is absent on purpose: those videos are moving to Gan Jing
  // World, so their address will be replaced rather than deleted.
  { table: "cms_videos", columns: ["body_markdown", "description"], clears: ["cover_image"] },
  { table: "cms_materials", columns: ["body_markdown", "summary"], clears: ["cover_image"] }
];

async function readSlice(table, select, filter, narrow) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    let q = supabase.from(table).select(select).or(filter);
    if (narrow) q = narrow(q);
    const { data, error } = await q.range(from, from + 499);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}

async function readAll(table, columns, chunkBy) {
  const select = ["id", "slug", ...columns].join(", ");
  const filter = columns.map((c) => `${c}.ilike.%tuidang.org/wp-content/%`).join(",");
  if (!chunkBy) return readSlice(table, select, filter);
  const rows = [];
  for (const year of YEARS) {
    rows.push(
      ...(await readSlice(table, select, filter, (q) =>
        q.gte(chunkBy, `${year}-01-01`).lt(chunkBy, `${year + 1}-01-01`)
      ))
    );
    process.stdout.write(`\r  扫描 ${table} ${year}… ${rows.length} 行   `);
  }
  rows.push(...(await readSlice(table, select, filter, (q) => q.is(chunkBy, null))));
  process.stdout.write(`\r  扫描 ${table}：${rows.length} 行                 \n`);
  return rows;
}

const changes = [];
const stats = { images: 0, links: 0, shortcodes: 0, bare: 0, heroes: 0, emptied: 0 };
const samples = [];

for (const target of TARGETS) {
  const all = [...target.columns, ...target.clears];
  let rows;
  try {
    rows = await readAll(target.table, all, target.chunkBy);
  } catch (error) {
    console.log(`  （跳过 ${target.table}：${error.message}）`);
    continue;
  }
  for (const row of rows) {
    const before = {};
    const after = {};

    for (const column of target.columns) {
      const text = row[column];
      if (typeof text !== "string" || !text) continue;
      let next = text;
      for (const url of dead) {
        if (!next.includes(url)) continue;
        const u = esc(url);
        stats.images += (next.match(new RegExp(`!\\[[^\\]]*\\]\\(\\s*${u}`, "g")) ?? []).length;
        stats.links += (next.match(new RegExp(`(?<!!)\\[[^\\]]*\\]\\(\\s*${u}`, "g")) ?? []).length;
        stats.shortcodes += (next.match(new RegExp(`\\[(?:audio|video)[^\\]]*${u}`, "gi")) ?? []).length;
        next = stripFrom(next, url);
      }
      next = clean(next);
      if (next === text) continue;
      before[column] = text;
      after[column] = next;
      if (column === "body_markdown" && next.trim() === "") stats.emptied++;
      if (samples.length < 5 && column === "body_markdown") {
        samples.push({ slug: row.slug, before: text.length, after: next.length });
      }
    }

    for (const column of target.clears) {
      const value = row[column];
      if (typeof value !== "string" || !value) continue;
      if (!dead.some((url) => value.startsWith(url))) continue;
      before[column] = value;
      after[column] = "";
      stats.heroes++;
    }

    if (Object.keys(after).length > 0) {
      changes.push({ table: target.table, id: row.id, slug: row.slug, before, after });
    }
  }
}

{
  const { data: rows, error } = await supabase
    .from(JSON_TARGET.table)
    .select(`id, path, ${JSON_TARGET.column}`);
  if (error) console.log(`  （跳过 ${JSON_TARGET.table}：${error.message}）`);
  for (const row of rows ?? []) {
    const text = JSON.stringify(row[JSON_TARGET.column] ?? {});
    let next = text;
    for (const url of dead) {
      if (!next.includes(url)) continue;
      // Inside JSON an address is a whole string value: blank it rather than
      // delete it, so the surrounding record keeps its shape and the template
      // simply renders no picture.
      next = next.split(`"${url}"`).join('""');
      next = stripFrom(next, url);
      stats.heroes++;
    }
    if (next === text) continue;
    changes.push({
      table: JSON_TARGET.table,
      id: row.id,
      slug: row.path,
      before: { [JSON_TARGET.column]: row[JSON_TARGET.column] },
      after: { [JSON_TARGET.column]: JSON.parse(next) }
    });
  }
}

console.log(`\n  将改动 ${changes.length} 行\n`);
console.log(`    移除图片      ${stats.images}`);
console.log(`    移除链接      ${stats.links}`);
console.log(`    移除音频短代码 ${stats.shortcodes}`);
console.log(`    清空封面图    ${stats.heroes}`);
if (stats.emptied > 0) console.log(`    ⚠️ 正文会被清空的文章 ${stats.emptied} 篇 —— 请先人工看一眼`);

console.log("\n  正文长度变化样例：");
for (const s of samples) console.log(`    ${String(s.before).padStart(6)} → ${String(s.after).padStart(6)} 字   /news/${s.slug.slice(0, 30)}`);

if (changes.length === 0) {
  console.log("\n  没有需要改的。");
  process.exit(0);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(BACKUP_DIR, `drop-dead-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({ at: stamp, changes }, null, 2));
console.log(`\n  备份已写入 ${path.relative(process.cwd(), file)}`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

let done = 0;
const failed = [];
for (const entry of changes) {
  const error = await withRetry(
    () => supabase.from(entry.table).update(entry.after).eq("id", entry.id),
    `${entry.table}/${entry.id}`
  );
  if (error) failed.push({ ...entry, error: error.message });
  else done++;
  if (done % 20 === 0) process.stdout.write(`\r  已改 ${done}/${changes.length}   `);
}
console.log(`\r  已改 ${done}/${changes.length} 行            `);
if (failed.length > 0) {
  console.log(`  ${failed.length} 行失败：`);
  for (const f of failed.slice(0, 8)) console.log(`    ${f.table}/${f.id}: ${f.error}`);
  process.exitCode = 1;
}
/*
 * An article whose entire body was a link to the missing file now has no body.
 * Leaving it published would put an empty page in the archive, so it goes back
 * to draft -- visible in 文章管理, invisible to readers, and one click to
 * restore if the video turns up.
 */
const emptied = changes.filter(
  (c) => c.table === "cms_articles" && c.after.body_markdown !== undefined && c.after.body_markdown.trim() === ""
);
for (const entry of emptied) {
  const { error } = await supabase.from("cms_articles").update({ status: "draft" }).eq("id", entry.id);
  console.log(
    error
      ? `  ⚠️ 未能把 /news/${entry.slug} 转为草稿：${error.message}`
      : `  /news/${entry.slug} 正文已空，已转为草稿（可在文章管理里改回发布）`
  );
}

console.log(`\n  撤销：node --env-file=.env.local scripts/drop-dead-wp-content.mjs --restore ${path.relative(process.cwd(), file)}`);
