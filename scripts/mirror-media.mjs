/**
 * Mirrors the Supabase Storage bucket to a second place we control.
 *
 * Why this exists: static-ifying the site protected the *pages* but not the
 * media. A cached page is served by Vercel, yet every <img>, <audio> and PDF
 * link inside it still points at sukwifqplsyhbwmlfuti.supabase.co, so the
 * browser goes back to Supabase for each one. On 2026-10-13 Storage answered
 * 544 alongside the database, which means a reader on a perfectly cached page
 * would have seen a wall of broken images. Every piece of media the site owns
 * -- 8,507 objects, ~6 GB, referenced by ~9,300 distinct URLs across 6,364
 * rows -- currently exists in exactly one place, inside the one project that
 * went down.
 *
 * What it does: walks the bucket, compares against what the mirror already
 * has, and downloads only what is missing or has changed size. Interrupting it
 * is safe; running it again picks up where it stopped. It writes nothing back
 * to Supabase and never deletes from the mirror unless asked.
 *
 *   node scripts/mirror-media.mjs --to ../quitccp-media-mirror           # full
 *   node scripts/mirror-media.mjs --to <dir> --only home,videos          # subset
 *   node scripts/mirror-media.mjs --to <dir> --dry-run                   # plan only
 *   node scripts/mirror-media.mjs --to <dir> --verify                    # re-hash
 *
 * The local mirror is also the staging ground for a servable copy: once it is
 * complete, any S3-compatible target is one command away, e.g.
 *   rclone sync <dir> r2:tuidang-media --progress
 * which is why the layout under <dir> is kept identical to the bucket's.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createWriteStream, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* The root .env.local is the only local source of secrets -- apps/web has no
   env file of its own, by instruction, and production reads Vercel's vars. */
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

function flag(name, fallback = null) {
  const at = process.argv.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const next = process.argv[at + 1];
  return next && !next.startsWith("--") ? next : true;
}

const target = flag("to");
if (!target || target === true) {
  console.error("用法: node scripts/mirror-media.mjs --to <目录> [--only a,b] [--dry-run] [--verify]");
  process.exit(1);
}
const mirrorRoot = path.resolve(repoRoot, target);
const dryRun = flag("dry-run") === true;
const verify = flag("verify") === true;
const only = typeof flag("only") === "string" ? flag("only").split(",").map((s) => s.trim()) : null;
const concurrency = Number(flag("concurrency", 6));

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/*
 * The bucket is a flat object store whose keys merely contain slashes, and
 * `list()` returns one level at a time, marking a pseudo-folder with a null
 * id. So enumerating it is a walk, and a walk that pages: a prefix with more
 * than 1,000 entries -- articles/ has thousands -- is silently truncated
 * otherwise.
 */
async function walkBucket(prefix, out = []) {
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`列出 ${prefix || "/"} 失败: ${error.message}`);
    if (!data.length) break;
    for (const entry of data) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) await walkBucket(key, out);
      else out.push({ key, size: entry.metadata?.size ?? 0, etag: entry.metadata?.eTag ?? null });
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

async function localState(key, expected) {
  try {
    const info = await stat(path.join(mirrorRoot, key));
    if (!info.isFile()) return "missing";
    if (info.size !== expected.size) return "changed";
    if (!verify) return "present";
    const hash = createHash("md5").update(await readFile(path.join(mirrorRoot, key))).digest("hex");
    /* Supabase returns S3-style eTags, quoted, and multipart ones carry a
       `-N` suffix that is a hash of hashes -- those we cannot check this way. */
    const etag = expected.etag?.replace(/"/g, "");
    if (!etag || etag.includes("-")) return "present";
    return etag === hash ? "present" : "changed";
  } catch {
    return "missing";
  }
}

/* Download to a sibling .part file and rename on success, so an interrupted
   run never leaves a truncated file that the next run would accept on size. */
async function download(key) {
  const destination = path.join(mirrorRoot, key);
  await mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;

  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error) throw new Error(error.message);
  await pipeline(Readable.fromWeb(data.stream()), createWriteStream(partial));
  await rename(partial, destination);
  return (await stat(destination)).size;
}

console.log(`桶 ${bucket} @ ${new URL(supabaseUrl).host}`);
console.log(`镜像 ${mirrorRoot}${dryRun ? "   (dry-run，不下载)" : ""}`);
process.stdout.write("清点桶内对象…");

const objects = (await walkBucket("")).filter(
  (object) => !only || only.some((top) => object.key === top || object.key.startsWith(`${top}/`))
);
console.log(` ${objects.length} 个，共 ${mb(objects.reduce((sum, o) => sum + o.size, 0))} MB`);

process.stdout.write(`比对镜像${verify ? "（逐个校验 md5，较慢）" : ""}…`);
const plan = [];
let present = 0;
for (const object of objects) {
  const state = await localState(object.key, object);
  if (state === "present") present += 1;
  else plan.push({ ...object, state });
}
const planBytes = plan.reduce((sum, o) => sum + o.size, 0);
console.log(` 已有 ${present} 个，待取 ${plan.length} 个（${mb(planBytes)} MB）`);

if (!plan.length) {
  console.log("\n镜像已经是最新的。");
  process.exit(0);
}
if (dryRun) {
  for (const object of plan.slice(0, 20)) console.log(`  ${object.state.padEnd(8)} ${mb(object.size).padStart(7)} MB  ${object.key}`);
  if (plan.length > 20) console.log(`  …另有 ${plan.length - 20} 个`);
  process.exit(0);
}

let done = 0;
let bytes = 0;
const failures = [];
const started = Date.now();

/* A fixed pool rather than Promise.all over 8,507 objects: the bucket is the
   thing we are trying to stop overloading, and this runs against the same
   project that fell over under load two days ago. */
async function worker() {
  for (;;) {
    const object = plan.shift();
    if (!object) return;
    try {
      bytes += await download(object.key);
    } catch (error) {
      failures.push({ key: object.key, message: error.message });
    }
    done += 1;
    if (done % 25 === 0 || done === objects.length) {
      const rate = bytes / 1024 / 1024 / ((Date.now() - started) / 1000);
      process.stdout.write(`\r  ${done} 个 · ${mb(bytes)} MB · ${rate.toFixed(1)} MB/s · 失败 ${failures.length}   `);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
process.stdout.write("\n");

/* The manifest is what makes the mirror auditable: it records what the bucket
   held at this moment, so a later run -- or a human -- can tell a missing file
   from one that was never there. */
const manifest = {
  bucket,
  source: new URL(supabaseUrl).host,
  mirroredAt: new Date().toISOString(),
  objectCount: objects.length,
  totalBytes: objects.reduce((sum, o) => sum + o.size, 0),
  objects: objects.map((o) => ({ key: o.key, size: o.size, etag: o.etag }))
};
await writeFile(path.join(mirrorRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\n完成：取回 ${done - failures.length} 个，${mb(bytes)} MB，用时 ${((Date.now() - started) / 1000 / 60).toFixed(1)} 分钟`);
console.log(`清单：${path.join(mirrorRoot, "manifest.json")}`);
if (failures.length) {
  console.log(`\n失败 ${failures.length} 个（再运行一次会重试）：`);
  for (const failure of failures.slice(0, 15)) console.log(`  ${failure.key} — ${failure.message}`);
  if (failures.length > 15) console.log(`  …另有 ${failures.length - 15} 个`);
  process.exit(1);
}
