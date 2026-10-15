/**
 * Pushes the local media mirror up to Cloudflare R2, so the copy is somewhere
 * a reader's browser can actually reach.
 *
 * This is the second half of the media problem. `mirror-media.mjs` pulls the
 * bucket down to disk, which answers "at least have a backup". It does not
 * answer the other half: when Supabase Storage returns 544, as it did on
 * 2026-10-13, a reader on a perfectly cached page still sees broken images.
 * For that, the copy has to be served, and served from a company that is
 * neither Supabase nor Vercel -- otherwise one outage still takes both.
 *
 * R2 was chosen because egress is free (the mirror only earns its keep during
 * an incident, which is exactly when traffic spikes), 6 GB sits inside the
 * free tier, and the centre is already on Cloudflare for every other subdomain.
 *
 * Uploads are skipped when R2 already holds an object of the same key and
 * size, so this is incremental and safe to re-run; interrupting it loses only
 * whatever was in flight.
 *
 *   # one-time, in the root .env.local:
 *   R2_ACCOUNT_ID=...
 *   R2_ACCESS_KEY_ID=...
 *   R2_SECRET_ACCESS_KEY=...
 *   R2_BUCKET=tuidang-media
 *
 *   node scripts/mirror-media.mjs --to ../quitccp-media-mirror   # pull first
 *   node scripts/push-media-mirror.mjs --from ../quitccp-media-mirror --dry-run
 *   node scripts/push-media-mirror.mjs --from ../quitccp-media-mirror
 *
 * Afterwards, point a Cloudflare custom domain (media.tdinfo.org, proxied) at
 * the bucket and set NEXT_PUBLIC_MEDIA_MIRROR_HOST=media.tdinfo.org in Vercel.
 *
 * The host is tdinfo.org and not a tuidang.org subdomain for one practical
 * reason: R2 requires the bucket and its custom domain to sit in the same
 * Cloudflare account, and nobody working on this has billing rights in the
 * account that holds tuidang.org -- the R2 subscription button is simply greyed
 * out there. A domain registered in our own account removes that dependency
 * altogether. Done 2026-10-14; the mirror is live and verified.
 * Until that variable is set the site does not consult the mirror at all, so
 * uploading early changes nothing and risks nothing.
 */
import { AwsClient } from "aws4fetch";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const source = flag("from");
if (!source || source === true) {
  console.error("用法: node scripts/push-media-mirror.mjs --from <本地镜像目录> [--dry-run] [--only a,b]");
  process.exit(1);
}
const mirrorRoot = path.resolve(repoRoot, source);
const dryRun = flag("dry-run") === true;
const only = typeof flag("only") === "string" ? flag("only").split(",").map((s) => s.trim()) : null;
const concurrency = Number(flag("concurrency", 8));

const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter(
  (name) => !process.env[name]
);
if (missing.length) {
  console.error(`缺少环境变量：${missing.join(", ")}`);
  console.error("在 Cloudflare 控制台 R2 → Manage API tokens 里建一个 Object Read & Write 令牌，填进根目录 .env.local。");
  process.exit(1);
}

const bucket = process.env.R2_BUCKET;
/* R2_ENDPOINT overrides the host. It is the usual escape hatch for
   S3-compatible tooling, and it is what lets the listing and planning paths
   be exercised against a mock before any real credentials exist. */
const endpoint = process.env.R2_ENDPOINT
  ? `${process.env.R2_ENDPOINT.replace(/\/$/, "")}/${bucket}`
  : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;
const aws = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto"
});

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/* Content types matter here in a way they do not on disk: R2 serves these
   straight to a browser, and an image sent as application/octet-stream is a
   download prompt, not a picture. */
const CONTENT_TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", ico: "image/x-icon",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
  pdf: "application/pdf", zip: "application/zip", json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8"
};
const contentType = (key) =>
  CONTENT_TYPES[(key.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase()] ?? "application/octet-stream";

async function walkLocal(dir, prefix = "", out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walkLocal(path.join(dir, entry.name), key, out);
    else if (!entry.name.endsWith(".part") && entry.name !== "manifest.json") {
      out.push({ key, size: (await stat(path.join(dir, entry.name))).size });
    }
  }
  return out;
}

/* What R2 already holds, so a re-run uploads only the difference. Paged,
   because 8,507 keys is well past ListObjectsV2's 1,000 per response. */
async function listRemote() {
  const held = new Map();
  let token = null;
  for (;;) {
    const url = new URL(endpoint);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1000");
    if (token) url.searchParams.set("continuation-token", token);
    const response = await aws.fetch(url.toString());
    if (!response.ok) throw new Error(`列出 R2 失败 ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const xml = await response.text();
    for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
      const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
      const size = Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? -1);
      if (key) held.set(decodeXml(key), size);
    }
    token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? null;
    if (!token) break;
  }
  return held;
}

const decodeXml = (text) =>
  text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function upload(key) {
  const body = await readFile(path.join(mirrorRoot, key));
  /* R2 rejects an unsigned-payload PUT, so the hash is required, not optional. */
  const response = await aws.fetch(`${endpoint}/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body,
    headers: {
      "content-type": contentType(key),
      "x-amz-content-sha256": createHash("sha256").update(body).digest("hex"),
      /* These are immutable, content-addressed-ish object keys that only ever
         get added to, so a long cache is safe and keeps egress near zero. */
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 160)}`);
  return body.length;
}

console.log(`本地镜像 ${mirrorRoot}`);
console.log(`R2 桶 ${bucket}${dryRun ? "   (dry-run，不上传)" : ""}`);

process.stdout.write("清点本地文件…");
const local = (await walkLocal(mirrorRoot)).filter(
  (file) => !only || only.some((top) => file.key === top || file.key.startsWith(`${top}/`))
);
console.log(` ${local.length} 个，共 ${mb(local.reduce((sum, f) => sum + f.size, 0))} MB`);

process.stdout.write("清点 R2 已有…");
const remote = await listRemote();
console.log(` ${remote.size} 个`);

const plan = local.filter((file) => remote.get(file.key) !== file.size);
const planBytes = plan.reduce((sum, f) => sum + f.size, 0);
console.log(`待上传 ${plan.length} 个（${mb(planBytes)} MB）`);

const orphans = [...remote.keys()].filter((key) => !local.some((file) => file.key === key));
if (orphans.length) {
  console.log(`\nR2 上有 ${orphans.length} 个本地镜像里没有的对象（不动它们；删除请手动确认）：`);
  for (const key of orphans.slice(0, 10)) console.log(`  ${key}`);
}

if (!plan.length) {
  console.log("\nR2 已经和本地镜像一致。");
  process.exit(0);
}
if (dryRun) {
  for (const file of plan.slice(0, 20)) console.log(`  ${mb(file.size).padStart(7)} MB  ${file.key}`);
  if (plan.length > 20) console.log(`  …另有 ${plan.length - 20} 个`);
  process.exit(0);
}

let done = 0;
let bytes = 0;
const failures = [];
const started = Date.now();
const queue = [...plan];

async function worker() {
  for (;;) {
    const file = queue.shift();
    if (!file) return;
    try {
      /* Not `bytes += await upload(...)`: that reads `bytes` before awaiting,
         so two workers finishing around each other lose one of the additions
         and the reported total comes out short. */
      const sent = await upload(file.key);
      bytes += sent;
    } catch (error) {
      failures.push({ key: file.key, message: error.message });
    }
    done += 1;
    if (done % 25 === 0 || done === plan.length) {
      const rate = bytes / 1024 / 1024 / ((Date.now() - started) / 1000);
      process.stdout.write(`\r  ${done}/${plan.length} · ${mb(bytes)} MB · ${rate.toFixed(1)} MB/s · 失败 ${failures.length}   `);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
process.stdout.write("\n");

console.log(`\n完成：上传 ${done - failures.length} 个，${mb(bytes)} MB，用时 ${((Date.now() - started) / 1000 / 60).toFixed(1)} 分钟`);
if (failures.length) {
  console.log(`\n失败 ${failures.length} 个（再运行一次会重试）：`);
  for (const failure of failures.slice(0, 15)) console.log(`  ${failure.key} — ${failure.message}`);
  process.exit(1);
}
console.log(`
下一步（Cloudflare 控制台）：
  1. R2 → ${bucket} → Settings → Custom Domains → Add → media.tdinfo.org
     最低 TLS 选 1.2。Public Development URL（r2.dev）保持关闭 ——
     开了它，所有 WAF 规则都能被绕过。
  2. 等状态变 Active，验证：curl -I https://media.tdinfo.org/<任一文件名>
  3. Vercel → quitccp → Settings → Environment Variables
     NEXT_PUBLIC_MEDIA_MIRROR_HOST=media.tdinfo.org （Production）
  4. 重新部署一次，首页 <head> 里会多出 id="media-failover" 的那段脚本
在第 3 步之前，站点完全不看镜像，所以前面几步随时可做，不影响线上。`);
