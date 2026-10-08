/**
 * Gives every film a cover.
 *
 * 66 of the 681 published films render as a flat dark rectangle in the card
 * grids, because `cover_image` is empty. The picture exists -- YouTube keeps a
 * thumbnail for every video -- it was simply never recorded.
 *
 * The frames are copied into Supabase Storage rather than hot-linked, which is
 * where all 615 of the existing covers already live: the site deliberately
 * stopped depending on outside hosts for images, and a thumbnail that loads
 * from i.ytimg.com would quietly undo that for these 66.
 *
 * YouTube offers several sizes. maxresdefault exists only for videos uploaded
 * large enough, so it is tried first and hqdefault -- which always exists --
 * is the fallback. 干净世界 has no equivalent, so its film's cover is read from
 * the og:image on the watch page.
 *
 *   node --env-file=.env.local scripts/backfill-video-covers.mjs
 *   node --env-file=.env.local scripts/backfill-video-covers.mjs --apply
 *   node --env-file=.env.local scripts/backfill-video-covers.mjs --restore backups/covers-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const RESTORE = (() => {
  const i = process.argv.indexOf("--restore");
  return i === -1 ? null : process.argv[i + 1];
})();

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "media";
const PUBLIC_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

if (RESTORE) {
  const b = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  for (const c of b.changes) {
    const { error } = await s.from("cms_videos").update({ cover_image: c.before }).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${b.changes.length} 支的封面图字段`);
  process.exit(0);
}

function youtubeId(url) {
  const v = String(url ?? "").trim();
  const m =
    v.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/) ??
    v.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/) ??
    v.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : "";
}

/** The first candidate that actually returns an image. */
async function fetchCover(video) {
  const id = youtubeId(video.source_url);
  const candidates = id
    ? [
        `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      ]
    : [];

  if (!id && /ganjing/i.test(video.source_url ?? "")) {
    const page = String(video.source_url).replace("/embed/", "/video/");
    try {
      const res = await fetch(page, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25000) });
      const html = await res.text();
      const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];
      if (og) candidates.push(og.replace(/&amp;/g, "&"));
    } catch {
      /* falls through to "没找到" below */
    }
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // YouTube answers a 120x90 grey placeholder instead of 404 for a size it
      // does not have; the real frames are far larger than this.
      if (buf.length < 4000) continue;
      const type = res.headers.get("content-type") ?? "image/jpeg";
      return { buf, url, mime: type.split(";")[0].trim() };
    } catch {
      /* try the next size */
    }
  }
  return null;
}

/* The films with no cover. */
let videos = [];
for (let page = 0; ; page += 1) {
  const { data, error } = await s
    .from("cms_videos")
    .select("id, slug, title, cover_image, source_url, status")
    .range(page * 500, page * 500 + 499);
  if (error) throw error;
  videos = videos.concat(data ?? []);
  if (!data || data.length < 500) break;
}
const missing = videos.filter((v) => v.status === "published" && !String(v.cover_image ?? "").trim());

console.log(`\n  已发布 ${videos.filter((v) => v.status === "published").length} 支，缺封面 ${missing.length} 支`);
if (missing.length === 0) process.exit(0);

console.log("  正在取封面…\n");
const found = [];
const notFound = [];
let done = 0;
const queue = [...missing];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const v = queue.shift();
      const got = await fetchCover(v);
      if (got) found.push({ v, ...got });
      else notFound.push(v);
      done += 1;
      if (done % 10 === 0) process.stdout.write(`\r  已处理 ${done}/${missing.length}   `);
    }
  })
);
process.stdout.write(`\r  已处理 ${done}/${missing.length}   \n\n`);

console.log(`  取到封面：${found.length}`);
console.log(`  取不到：  ${notFound.length}`);
for (const v of notFound.slice(0, 10)) console.log(`     ${v.title.slice(0, 44)}`);

const sizes = found.map((f) => f.buf.length);
if (sizes.length) {
  const mb = sizes.reduce((a, b) => a + b, 0) / 1024 / 1024;
  console.log(`\n  合计 ${mb.toFixed(1)} MB，平均 ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024)} KB`);
}

if (!APPLY) {
  console.log("\n  空跑 —— 没有上传也没有改数据库。确认后加 --apply。");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), changes: [] };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `covers-${backup.at.replace(/[:.]/g, "-")}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));

const assetRows = [];
let uploaded = 0;
for (const f of found) {
  /* Same shape as the existing covers: media/videos/<2 chars>/<hash>.jpg */
  const hash = crypto.createHash("sha1").update(f.buf).digest("hex").slice(0, 16);
  const ext = f.mime.includes("png") ? "png" : f.mime.includes("webp") ? "webp" : "jpg";
  const storagePath = `videos/${hash.slice(0, 2)}/${hash}.${ext}`;

  /* Storage answers 502 now and then. One blip should not abandon a run that
     has already fetched every frame, so each upload gets three tries. */
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await s.storage.from(BUCKET).upload(storagePath, f.buf, {
      contentType: f.mime,
      upsert: true
    });
    if (!error) { lastError = null; break; }
    lastError = error;
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  if (lastError) {
    console.log(`\n  跳过（上传三次都失败）：${f.v.title.slice(0, 36)} — ${lastError.message}`);
    continue;
  }

  const publicUrl = `${PUBLIC_BASE}${storagePath}`;
  const { error: updateError } = await s.from("cms_videos").update({ cover_image: publicUrl }).eq("id", f.v.id);
  if (updateError) throw updateError;

  backup.changes.push({ id: f.v.id, slug: f.v.slug, before: f.v.cover_image ?? "", after: publicUrl });
  assetRows.push({
    asset_type: "image",
    name: `${f.v.slug.slice(0, 60)}.${ext}`,
    storage_path: publicUrl,
    mime_type: f.mime,
    byte_size: f.buf.length,
    metadata: { description: "", source: "video thumbnail", originalUrl: f.url }
  });
  uploaded += 1;
  save();
  if (uploaded % 10 === 0) process.stdout.write(`\r  已上传 ${uploaded}/${found.length}   `);
}
save();
process.stdout.write(`\r  已上传 ${uploaded}/${found.length}   \n`);

/* `storage_path` has no unique constraint, so read first and insert the rest. */
const { data: known } = await s
  .from("cms_media_assets")
  .select("storage_path")
  .in("storage_path", assetRows.map((r) => r.storage_path));
const seen = new Set((known ?? []).map((r) => String(r.storage_path)));
const toRegister = assetRows.filter((r) => !seen.has(r.storage_path));
if (toRegister.length) {
  const { error } = await s.from("cms_media_assets").insert(toRegister);
  if (error) console.log(`  （登记到图片视频库时出错，不影响显示：${error.message}）`);
  else console.log(`  已登记 ${toRegister.length} 个文件到图片视频库`);
}

console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/backfill-video-covers.mjs --restore ${file}`);
