/**
 * Brings back the article images the migration dropped.
 *
 *   node --env-file=.env.local scripts/recover-wayback-images.mjs [--apply] [--limit N]
 *
 * 2,505 images across 367 articles are written in the bodies as old-site
 * relative paths -- `/d/file/news/jtzg/2012-10-29/<hash>.jpg` -- and resolve
 * to nothing, because www.tuidang.org is this site now. They were never
 * copied: `migrate-article-images.ts` decides what to fetch with
 *
 *     try { return OURS.test(new URL(url).hostname); } catch { return false; }
 *
 * and `new URL()` throws on a relative path, so every one of them was silently
 * declined. The absolute `https://www.tuidang.org/...` spellings came across
 * fine; there were 5 of those and 3,153 relative ones.
 *
 * The old server is gone and truth.tuidang.org no longer resolves, so the only
 * surviving copy is the Internet Archive's. It holds about 19,500 `/d/file/`
 * URLs, which covers roughly a sixth of what we need. This recovers that sixth
 * and leaves the rest alone -- it never edits an article whose images it could
 * not actually fetch.
 *
 * Re-runnable. An image already in the bucket is reused rather than fetched
 * again, and a body already rewritten no longer contains the path to match.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i === -1 ? Infinity : Number(process.argv[i + 1]) || Infinity;
})();

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media";
if (!SUPA || !KEY) throw new Error("缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const PUBLIC_BASE = `${SUPA}/storage/v1/object/public/${BUCKET}/`;
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const OUT = path.resolve("artifacts/image-recovery");

/** Same shape `migrate-article-images.ts` uses, so the bucket stays uniform. */
function storagePath(key) {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 16);
  const ext = (key.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "jpg").toLowerCase();
  return `articles/${hash.slice(0, 2)}/${hash}.${ext}`;
}

/**
 * Is this actually an image?
 *
 * The archive answers 200 for a URL it never captured, serving an HTML notice
 * in its place. Uploading those would replace 436 broken images with 436
 * broken images that look fixed, which is worse -- nobody would check again.
 */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG") return "image/png";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  return null;
}

async function readAllArticles() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPA}/rest/v1/cms_articles?select=id,title,slug,body_markdown&order=id`, {
      headers: { ...H, Range: `${from}-${from + 999}`, "Range-Unit": "items" }
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return out;
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/** Every /d/file/ path the Internet Archive has a 200 capture for. */
async function waybackIndex() {
  const found = new Map();

  /* Cached on disk, because the index is the expensive part and it barely
     changes: six requests returning 19,474 rows, against an archive that
     answers a burst of traffic by handing back an HTML error page. Re-fetching
     it on every run is how a retry loop turns into a rate-limit. Delete the
     file (or pass --refresh-index) to pull a fresh one. */
  const cacheFile = path.join(OUT, "cdx-index.json");
  if (!process.argv.includes("--refresh-index")) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      for (const [k, v] of Object.entries(cached)) found.set(k, v);
      console.error(`  存档索引：用本地缓存 ${found.size} 条（--refresh-index 可重取）`);
      return found;
    } catch {
      /* 没缓存就照常去取 */
    }
  }

  /* Ask how many pages there are rather than walking until something breaks:
     a page past the end comes back empty, which is indistinguishable from the
     empty body the archive returns when it is too busy to answer. Guessing
     wrong in one direction stops early and silently loses images; in the other
     it treats a normal ending as a failure. */
  const CDX = "http://web.archive.org/cdx/search/cdx?url=tuidang.org/d/file*";
  let pages = 0;
  for (let attempt = 1; attempt <= 4 && !pages; attempt += 1) {
    try {
      const res = await fetch(`${CDX}&showNumPages=true`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(120000) });
      const n = Number((await res.text()).trim());
      if (!Number.isInteger(n) || n < 1) throw new Error("页数读不出来");
      pages = n;
    } catch (error) {
      if (attempt === 4) { console.error(`  ⚠ 问不到存档页数：${String(error).slice(0, 70)}`); process.exit(1); }
      await new Promise((r) => setTimeout(r, attempt * 8000));
    }
  }
  console.error(`  存档索引共 ${pages} 页`);

  for (let page = 0; page < pages; page += 1) {
    const url = `${CDX}&output=json&collapse=urlkey&filter=statuscode:200&fl=timestamp,original&page=${page}`;
    /* The archive answers a busy moment with an HTML error page rather than a
       status code, so a page can "succeed" and parse as nothing. Each one is
       worth several thousand index entries -- losing one silently cost a third
       of the recoverable images on the first run -- so retry before moving on,
       and stop the whole walk rather than pretend the index is complete. */
    let rows = null;
    for (let attempt = 1; attempt <= 4 && !rows; attempt += 1) {
      try {
        const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(300000) });
        const text = await res.text();
        if (!text.trim().startsWith("[")) throw new Error(`档案馆返回的不是 JSON（${text.trim().slice(0, 40)}）`);
        rows = JSON.parse(text);
      } catch (error) {
        if (attempt === 4) {
          console.error(`  ⚠ CDX 第 ${page} 页重试 4 次仍失败：${String(error).slice(0, 70)}`);
          console.error(`     索引不完整，先不动手。过一会儿再跑一次。`);
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, attempt * 8000));
      }
    }
    if (!Array.isArray(rows) || rows.length <= 1) break;
    for (const [timestamp, original] of rows.slice(1)) {
      const m = /(\/d\/file\/.*)$/.exec(original);
      /* Keep the earliest capture: the old site rotated in placeholder art as
         links rotted, so a later snapshot is likelier to be the stand-in. */
      if (m && !found.has(m[1])) found.set(m[1], { timestamp, original });
    }
    process.stderr.write(`  CDX 第 ${page} 页 → 累计 ${found.size}\n`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(found)));
  console.error(`  索引已缓存到 ${path.relative(process.cwd(), cacheFile)}`);
  return found;
}

/* ---------------------------------------------------------------- */

console.log(`\n  ${APPLY ? "正式执行" : "试运行（不下载、不写入；加 --apply 才动真格）"}\n`);

const articles = await readAllArticles();
const RE = /(?:!\[[^\]]*\]\(|<img[^>]+src=")(\/d\/file\/[^)"\s]+)/g;
const wanted = new Map(); // 路径 -> 用到它的文章 id
for (const a of articles) {
  for (const m of (a.body_markdown ?? "").matchAll(RE)) {
    if (!wanted.has(m[1])) wanted.set(m[1], new Set());
    wanted.get(m[1]).add(a.id);
  }
}
console.log(`  文章 ${articles.length} 篇，正文里失效的老图地址 ${wanted.size} 个\n`);

console.log("  查互联网档案馆…");
const archive = await waybackIndex();
const recoverable = [...wanted.keys()].filter((p) => archive.has(p)).slice(0, LIMIT);
console.log(`\n  存档里有的 ${recoverable.length} 个，没有的 ${wanted.size - recoverable.length} 个\n`);

if (!APPLY) {
  for (const p of recoverable.slice(0, 5)) {
    console.log(`    ${p.slice(0, 64)}`);
    console.log(`      存档 ${archive.get(p).timestamp}  →  ${storagePath(p)}`);
  }
  console.log(`\n  试运行结束。加 --apply 才会下载、上传并改写正文。\n`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

/* ---- 取回并入库 ---- */
const map = new Map();
const failed = [];
let bytes = 0;
let cursor = 0;

async function worker() {
  while (cursor < recoverable.length) {
    const key = recoverable[cursor++];
    const { timestamp, original } = archive.get(key);
    const dest = storagePath(key);
    try {
      /* `id_` asks the archive for the bytes it captured, without the replay
         toolbar it otherwise injects into the response. */
      const res = await fetch(`https://web.archive.org/web/${timestamp}id_/${original}`, {
        headers: { "user-agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(90000)
      });
      if (!res.ok) { failed.push({ key, why: `存档 HTTP ${res.status}` }); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const type = sniff(buf);
      if (!type) { failed.push({ key, why: `取回的不是图片（${buf.length} 字节）` }); continue; }
      if (buf.length < 1024) { failed.push({ key, why: `太小，${buf.length} 字节` }); continue; }

      const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${dest}`, {
        method: "POST",
        headers: { ...H, "content-type": type, "x-upsert": "true", "cache-control": "31536000" },
        body: buf
      });
      if (!up.ok && up.status !== 409) {
        failed.push({ key, why: `上传 ${up.status} ${(await up.text()).slice(0, 80)}` });
        continue;
      }
      map.set(key, PUBLIC_BASE + dest);
      bytes += buf.length;
    } catch (error) {
      failed.push({ key, why: String(error).slice(0, 70) });
    }
    const done = map.size + failed.length;
    if (done % 50 === 0) process.stderr.write(`  …${done}/${recoverable.length}  成功 ${map.size}  失败 ${failed.length}\n`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`\n  取回 ${map.size} 张（${(bytes / 1024 / 1024).toFixed(1)} MB），失败 ${failed.length} 张\n`);

/* ---- 改写正文 ---- */
const touched = articles.filter((a) =>
  [...map.keys()].some((k) => (a.body_markdown ?? "").includes(k))
);
writeFileSync(
  path.join(OUT, "before.json"),
  JSON.stringify(touched.map((a) => ({ id: a.id, title: a.title, body_markdown: a.body_markdown })), null, 1)
);
console.log(`  改动前的正文已存到 artifacts/image-recovery/before.json（${touched.length} 篇，可据此回滚）\n`);

let ok = 0;
const writeFailed = [];
for (const a of touched) {
  let body = a.body_markdown;
  let hits = 0;
  /* Longest first: one path can be a prefix of another, and replacing the
     short one first would corrupt the long one. */
  for (const key of [...map.keys()].sort((x, y) => y.length - x.length)) {
    if (!body.includes(key)) continue;
    hits += body.split(key).length - 1;
    body = body.split(key).join(map.get(key));
  }
  if (!hits) continue;
  const res = await fetch(`${SUPA}/rest/v1/cms_articles?id=eq.${a.id}`, {
    method: "PATCH",
    headers: { ...H, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ body_markdown: body })
  });
  if (res.ok) { ok += 1; console.log(`  ✓ ${String(hits).padStart(3)} 张  《${a.title.slice(0, 40)}》`); }
  else { writeFailed.push({ id: a.id, title: a.title, status: res.status, detail: (await res.text()).slice(0, 120) }); }
}

writeFileSync(path.join(OUT, "map.json"), JSON.stringify({ map: Object.fromEntries(map), failed, writeFailed }, null, 1));
console.log(`\n  ${"─".repeat(66)}`);
console.log(`  改写文章 ${ok} 篇${writeFailed.length ? `，写入失败 ${writeFailed.length} 篇` : ""}`);
console.log(`  图片取回 ${map.size} 张，取不到 ${failed.length} 张`);
console.log(`  明细 artifacts/image-recovery/map.json\n`);
