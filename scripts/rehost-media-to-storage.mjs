/**
 * Moves the files still hosted at `tuidang.org/wp-content/` into our own
 * Supabase Storage, and repoints every reference at the new address.
 *
 * This is the permanent fix for the dependency described in
 * docs/implementation/domain-transition.md section 2. Unlike
 * `rehost-wp-content.mjs`, which only rewrites addresses to another host still
 * run by the old site, this one copies the bytes, so nothing on the new site
 * depends on the old server staying up.
 *
 * Files that cannot be fetched are REPORTED, never silently skipped: the old
 * server returns 404 for files it no longer has, and Cloudflare returns a
 * challenge page for some media. Either way the reference is already broken on
 * the live site, and that is worth knowing rather than hiding.
 *
 * Nothing is written -- to storage or to the database -- without `--apply`.
 *
 *   node --env-file=.env.local scripts/rehost-media-to-storage.mjs
 *   node --env-file=.env.local scripts/rehost-media-to-storage.mjs --limit 3 --apply
 *   node --env-file=.env.local scripts/rehost-media-to-storage.mjs --apply
 *   node --env-file=.env.local scripts/rehost-media-to-storage.mjs --restore backups/rehost-storage-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const APPLY = args.includes("--apply");
const LIMIT = Number(flag("--limit") ?? "0") || 0;
const RESTORE = flag("--restore");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "media";
/** Everything lands under this prefix, so a later audit can tell what came from
 *  the old WordPress install. The path after `uploads/` is preserved, which
 *  keeps the year/month structure and makes collisions impossible. */
const PREFIX = "legacy";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/** Columns that can hold one of these addresses. Explicit, not a blind scan. */
const TARGETS = [
  // `body_markdown` is what the article page renders; `body_plain` is the
  // flattened copy used for search. Both must be rewritten -- an earlier
  // version of this list omitted the markdown column, which would have left
  // every reference the reader actually sees pointing at the old server.
  {
    table: "cms_articles",
    columns: ["hero_image", "body_markdown", "body_plain", "summary"],
    chunkBy: "published_at"
  },
  { table: "cms_videos", columns: ["source_url", "cover_image", "body_markdown", "description"] },
  { table: "cms_materials", columns: ["cover_image", "body_markdown", "summary"] },
  // The FAQ was imported from the old site after this script first ran, so its
  // answers still embed images from /wp-content/. Those die with the domain.
  { table: "cms_faqs", columns: ["answer_markdown"] }
];

/**
 * Page content lives in one jsonb column, so it cannot be scanned column by
 * column like the others. The homepage cards, the news thumbnails, the video
 * covers and the board portraits are all in here -- references a column-based
 * scan never saw.
 */
const JSON_TARGET = { table: "cms_content_entries", column: "data" };

const YEARS = Array.from({ length: new Date().getFullYear() - 2001 }, (_, i) => 2002 + i);
/**
 * Any tuidang.org host, not just `www.`.
 *
 * The imported articles also point at `m.tuidang.org`, `truth.tuidang.org` and
 * `global.tuidang.org`. The first two no longer resolve at all; a pattern that
 * only matched `www.` left 108 references invisible to this script while the
 * SQL filter still found their rows, which is how the mismatch surfaced.
 */
const URL_RE = /https?:\/\/[a-z0-9.-]*tuidang\.org\/wp-content\/[^\s"'<>)\]]+/gi;
const BACKUP_DIR = path.join(process.cwd(), "backups");

const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", pdf: "application/pdf"
};

const TRANSIENT = new Set(["57014", "40001", "08006", "08003"]);

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

/**
 * `body_plain` holds ~120MB of prose with no index on it, so an unqualified
 * `ilike` blows the 8s statement timeout. One year at a time is ~600ms.
 */
async function readAll(table, columns, chunkBy) {
  const select = ["id", ...columns].join(", ");
  const filter = columns.map((c) => `${c}.ilike.%tuidang.org/wp-content/%`).join(",");
  if (!chunkBy) return readSlice(table, select, filter);
  const rows = [];
  for (const year of YEARS) {
    rows.push(
      ...(await readSlice(table, select, filter, (q) =>
        q.gte(chunkBy, `${year}-01-01`).lt(chunkBy, `${year + 1}-01-01`)
      ))
    );
    process.stdout.write(`\r  扫描 ${table} ${year}… 已找到 ${rows.length} 行   `);
  }
  rows.push(...(await readSlice(table, select, filter, (q) => q.is(chunkBy, null))));
  process.stdout.write(`\r  扫描 ${table}：${rows.length} 行                    \n`);
  return rows;
}

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  let n = 0;
  const failed = [];
  for (const entry of backup.changes) {
    const error = await withRetry(
      () => supabase.from(entry.table).update(entry.before).eq("id", entry.id),
      `${entry.table}/${entry.id}`
    );
    if (error) failed.push(entry);
    else n++;
  }
  console.log(`\n  已还原 ${n} 行（${path.basename(RESTORE)}）`);
  if (failed.length > 0) {
    console.log(`  ${failed.length} 行未能还原 —— 对同一个文件再跑一次 --restore 即可。`);
    process.exitCode = 1;
  }
  console.log("  注意：已上传到 Storage 的文件不会被删除，重跑时会直接复用。");
  process.exit(0);
}

// ---------------------------------------------------------------- 1. collect
console.log("\n  第一步：找出所有还指向 tuidang.org/wp-content/ 的地址\n");

const rowsByTable = new Map();
const uses = new Map(); // url -> [{ table, id, column }]
for (const target of TARGETS) {
  let rows;
  try {
    rows = await readAll(target.table, target.columns, target.chunkBy);
  } catch (error) {
    console.log(`  （跳过 ${target.table}：${error.message}）`);
    continue;
  }
  rowsByTable.set(target.table, rows);
  for (const row of rows) {
    for (const column of target.columns) {
      const text = row[column];
      if (typeof text !== "string") continue;
      for (const m of text.matchAll(URL_RE)) {
        const url = m[0].replace(/[.,;:)]+$/, "");
        if (!uses.has(url)) uses.set(url, []);
        uses.get(url).push({ table: target.table, id: row.id, column });
      }
    }
  }
}

const { data: jsonRows, error: jsonError } = await supabase
  .from(JSON_TARGET.table)
  .select(`id, locale, path, ${JSON_TARGET.column}`);
if (jsonError) console.log(`  （跳过 ${JSON_TARGET.table}：${jsonError.message}）`);
const jsonMatched = [];
for (const row of jsonRows ?? []) {
  const text = JSON.stringify(row[JSON_TARGET.column] ?? {});
  const found = [...text.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:)]+$/, ""));
  if (found.length === 0) continue;
  jsonMatched.push(row);
  for (const url of found) {
    if (!uses.has(url)) uses.set(url, []);
    uses.get(url).push({ table: JSON_TARGET.table, id: row.id, column: JSON_TARGET.column });
  }
}
if (jsonMatched.length > 0) console.log(`  扫描 ${JSON_TARGET.table}：${jsonMatched.length} 行`);

let urls = [...uses.keys()].sort();
if (LIMIT) urls = urls.slice(0, LIMIT);
console.log(`\n  共 ${uses.size} 个不同地址，${[...uses.values()].reduce((a, b) => a + b.length, 0)} 处引用`);
if (LIMIT) console.log(`  --limit ${LIMIT}：本次只处理前 ${urls.length} 个`);

// ---------------------------------------------------------------- 2. fetch
console.log("\n  第二步：逐个下载\n");

/** Short stable digest, so a sanitised name stays unique and reproducible. */
function shortHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * `…/wp-content/uploads/2009/03/a.mp3` -> `legacy/2009/03/a.mp3`
 *
 * Supabase Storage keys must be ASCII, and several of these files are named in
 * Chinese (`三退-九评共产党-方伟….mp3`). Those segments are replaced with what
 * survives sanitising plus a short digest of the original, which keeps the name
 * unique without inventing a translation. The original address is kept in the
 * asset's metadata either way.
 */
function storagePathFor(url) {
  const host = new URL(url).host.replace(/^www\./, "").replace(/\.tuidang\.org$/, "");
  const sub = host && host !== "tuidang.org" ? `${host}/` : "";
  const after = sub + decodeURIComponent(new URL(url).pathname.replace(/^\/wp-content\/(uploads\/)?/, ""));
  const segments = after.replace(/^\/+/, "").split("/").map((segment) => {
    if (/^[A-Za-z0-9._-]+$/.test(segment)) return segment;
    const ext = segment.match(/\.([A-Za-z0-9]{2,4})$/)?.[0] ?? "";
    const stem = segment.slice(0, segment.length - ext.length).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${stem || "file"}-${shortHash(segment)}${ext}`;
  });
  return `${PREFIX}/${segments.join("/")}`;
}

const fetched = [];
const unreachable = [];
let done = 0;
for (const url of urls) {
  done++;
  process.stdout.write(`\r  下载 ${done}/${urls.length}  ${url.split("/").pop().slice(0, 34).padEnd(36)}`);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    const type = res.headers.get("content-type") ?? "";
    // Cloudflare answers a blocked request with an HTML challenge page and a
    // 403; treating that as the file would store a 6KB page named .mp4.
    if (!res.ok || type.startsWith("text/html")) {
      if (res.body) await res.body.cancel();
      unreachable.push({ url, status: res.status, type, uses: uses.get(url).length });
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fetched.push({ url, buf, type, storagePath: storagePathFor(url), uses: uses.get(url).length });
  } catch (error) {
    unreachable.push({ url, status: "ERR", type: String(error.message).slice(0, 40), uses: uses.get(url).length });
  }
}
process.stdout.write("\r".padEnd(80) + "\r");

const totalBytes = fetched.reduce((a, b) => a + b.buf.length, 0);
console.log(`  可下载 ${fetched.length} 个（${(totalBytes / 1048576).toFixed(1)} MB）`);
console.log(`  取不到 ${unreachable.length} 个`);

if (unreachable.length > 0) {
  const byStatus = {};
  for (const u of unreachable) byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;
  console.log(`    按状态：${JSON.stringify(byStatus)}`);
  const csv = [
    "地址,HTTP状态,引用处数",
    ...unreachable.map((u) => `"${u.url}",${u.status},${u.uses}`)
  ].join("\n");
  const out = path.join(process.cwd(), "docs/implementation/wp-content-unreachable.csv");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, csv);
  console.log(`    名单已写入 ${path.relative(process.cwd(), out)}`);
}

if (fetched.length === 0) {
  console.log("\n  没有可搬运的文件。");
  process.exit(0);
}

// ---------------------------------------------------------------- 3. plan
const publicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const map = new Map(fetched.map((f) => [f.url, publicBase + f.storagePath.split("/").map(encodeURIComponent).join("/")]));

const changes = [];
let fieldCount = 0;
for (const [table, rows] of rowsByTable) {
  const columns = TARGETS.find((t) => t.table === table).columns;
  for (const row of rows) {
    const before = {};
    const after = {};
    for (const column of columns) {
      const text = row[column];
      if (typeof text !== "string") continue;
      let next = text;
      for (const [from, to] of map) next = next.split(from).join(to);
      if (next === text) continue;
      before[column] = text;
      after[column] = next;
      fieldCount++;
    }
    if (Object.keys(after).length > 0) changes.push({ table, id: row.id, before, after });
  }
}

for (const row of jsonMatched) {
  const text = JSON.stringify(row[JSON_TARGET.column] ?? {});
  let next = text;
  for (const [from, to] of map) next = next.split(from).join(to);
  if (next === text) continue;
  changes.push({
    table: JSON_TARGET.table,
    id: row.id,
    before: { [JSON_TARGET.column]: row[JSON_TARGET.column] },
    after: { [JSON_TARGET.column]: JSON.parse(next) }
  });
  fieldCount++;
}

console.log(`\n  将改写 ${changes.length} 行、${fieldCount} 个字段\n`);
for (const f of fetched.slice(0, 6)) {
  console.log(`    ${(f.buf.length / 1048576).toFixed(2).padStart(7)} MB  ${f.storagePath}`);
}
if (fetched.length > 6) console.log(`    …另有 ${fetched.length - 6} 个`);

if (!APPLY) {
  console.log("\n  空跑 —— 没有上传任何文件，也没有改数据库。确认后加 --apply。");
  process.exit(0);
}

// ---------------------------------------------------------------- 4. upload
console.log("\n  第三步：上传到 Supabase Storage\n");
const uploadFailed = [];
let up = 0;
for (const f of fetched) {
  up++;
  const ext = (f.storagePath.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "").toLowerCase();
  const { error } = await supabase.storage.from(BUCKET).upload(f.storagePath, f.buf, {
    contentType: MIME[ext] ?? f.type ?? "application/octet-stream",
    // Re-running after a partial run must not fail on what is already there.
    upsert: true
  });
  if (error) uploadFailed.push({ path: f.storagePath, error: error.message });
  process.stdout.write(`\r  上传 ${up}/${fetched.length}   `);
}
console.log("");
if (uploadFailed.length > 0) {
  console.log(`  ${uploadFailed.length} 个上传失败，数据库不会改动：`);
  for (const u of uploadFailed.slice(0, 8)) console.log(`    ${u.path}: ${u.error}`);
  console.log("  修好后重跑同一条命令（已传的会直接覆盖，不会重复）。");
  process.exit(1);
}

// Register them so they appear in 图片视频库 like any other upload.
const assetRows = fetched.map((f) => {
  const ext = (f.storagePath.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "").toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  return {
    name: f.storagePath.split("/").pop(),
    storage_path: map.get(f.url),
    asset_type: mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "file",
    mime_type: mime,
    byte_size: f.buf.length,
    metadata: { description: "", source: "tuidang.org/wp-content", originalUrl: f.url }
  };
});
// `storage_path` carries no unique constraint, so an upsert cannot dedupe on
// it -- read what is already registered and insert only the rest.
const { data: existing } = await supabase
  .from("cms_media_assets")
  .select("storage_path")
  .in("storage_path", assetRows.map((r) => r.storage_path));
const known = new Set((existing ?? []).map((r) => String(r.storage_path)));
const toRegister = assetRows.filter((r) => !known.has(r.storage_path));
if (toRegister.length > 0) {
  const { error: registerError } = await supabase.from("cms_media_assets").insert(toRegister);
  if (registerError) console.log(`  （登记到图片视频库时出错，不影响页面显示：${registerError.message}）`);
  else console.log(`  已登记 ${toRegister.length} 个文件到图片视频库`);
}

// ---------------------------------------------------------------- 5. rewrite
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(BACKUP_DIR, `rehost-storage-${stamp}.json`);
// Written before any update: a run that dies half way must still be undoable.
fs.writeFileSync(backupFile, JSON.stringify({ at: stamp, bucket: BUCKET, changes }, null, 2));
console.log(`  备份已写入 ${path.relative(process.cwd(), backupFile)}`);

console.log("\n  第四步：改写数据库引用\n");
let written = 0;
const writeFailed = [];
for (const entry of changes) {
  const error = await withRetry(
    () => supabase.from(entry.table).update(entry.after).eq("id", entry.id),
    `${entry.table}/${entry.id}`
  );
  if (error) writeFailed.push({ table: entry.table, id: entry.id, error: error.message });
  else written++;
  if (written % 20 === 0) process.stdout.write(`\r  已改写 ${written}/${changes.length}   `);
}
console.log(`\r  已改写 ${written}/${changes.length} 行            `);
if (writeFailed.length > 0) {
  console.log(`  ${writeFailed.length} 行失败：`);
  for (const f of writeFailed.slice(0, 8)) console.log(`    ${f.table}/${f.id}: ${f.error}`);
  console.log("  重跑同一条命令即可，已改好的会跳过。");
  process.exitCode = 1;
}
console.log(`\n  撤销：node --env-file=.env.local scripts/rehost-media-to-storage.mjs --restore ${path.relative(process.cwd(), backupFile)}`);
