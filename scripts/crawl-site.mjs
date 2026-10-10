/**
 * Walks the live site and reports what is broken.
 *
 *   node scripts/crawl-site.mjs [--base https://www.tuidang.org] [--max 300]
 *
 * Starts at the homepage, follows every internal link it finds, and records
 * the status of each page plus the images that page asks for. The archive is
 * 15,527 articles, so this is deliberately bounded: it covers the navigation,
 * every section index, and whatever articles the site itself links to from
 * them -- the pages a reader can actually reach by clicking, which is the set
 * that matters for "is anything broken".
 *
 * Concurrency is kept low on purpose. A faster crawl saturates the PostgREST
 * connection pool and starts producing failures of its own, which would then
 * be reported as site faults.
 */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const BASE = (flag("--base", "https://www.tuidang.org") ?? "").replace(/\/$/, "");
const MAX = Number(flag("--max", 300));
const CONCURRENCY = Number(flag("--concurrency", 4));
const origin = new URL(BASE).origin;

const seen = new Set();
const queue = ["/"];
const pages = [];
/** image url -> the first page that asked for it */
const images = new Map();

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** Links worth following: same origin, a real page, not an asset. */
function internalLinks(html, from) {
  const out = new Set();
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
    let url;
    try {
      url = new URL(unescapeAttr(m[1]), from);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    if (/\.(jpg|jpeg|png|gif|webp|avif|svg|mp4|webm|mp3|pdf|zip|docx?)$/i.test(url.pathname)) continue;
    url.hash = "";
    out.add(url.pathname + url.search);
  }
  return out;
}

/* Attribute values arrive HTML-escaped. Requesting one without decoding sends
   `&amp;w=1200` where the browser sends `&w=1200`, and an image proxy answers
   that with a 400 -- a broken image that is broken only for this crawler. */
const unescapeAttr = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

function imagesIn(html, from) {
  const out = new Set();
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    try {
      const url = new URL(unescapeAttr(m[1]), from);
      if (!url.protocol.startsWith("http")) continue;
      out.add(url.href);
    } catch {
      /* data: and other shapes */
    }
  }
  return out;
}

async function visit(path) {
  const url = `${BASE}${path}`;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(45000)
    });
    const ms = Date.now() - started;
    const type = response.headers.get("content-type") ?? "";
    const html = type.includes("text/html") ? await response.text() : "";
    return { path, status: response.status, ms, finalUrl: response.url, html };
  } catch (error) {
    return { path, status: 0, ms: Date.now() - started, finalUrl: url, html: "", why: String(error).slice(0, 80) };
  }
}

console.log(`\n  爬 ${BASE}，最多 ${MAX} 页，并发 ${CONCURRENCY}\n`);

let active = 0;
await new Promise((resolve) => {
  const pump = () => {
    if (queue.length === 0 && active === 0) return resolve();
    while (active < CONCURRENCY && queue.length > 0 && seen.size < MAX) {
      const path = queue.shift();
      if (seen.has(path)) continue;
      seen.add(path);
      active += 1;
      void visit(path).then((result) => {
        pages.push(result);
        if (result.html) {
          for (const link of internalLinks(result.html, result.finalUrl)) {
            if (!seen.has(link) && seen.size + queue.length < MAX) queue.push(link);
          }
          for (const img of imagesIn(result.html, result.finalUrl)) {
            if (!images.has(img)) images.set(img, result.path);
          }
        }
        if (pages.length % 25 === 0) process.stdout.write(`  …${pages.length} 页\n`);
        active -= 1;
        pump();
      });
    }
    if (queue.length === 0 && active === 0) resolve();
  };
  pump();
});

/* ---- images: check each distinct one once, with a range request ---- */
console.log(`\n  查 ${images.size} 张图片…\n`);
const imageRows = [];
{
  const entries = [...images.entries()];
  let i = 0;
  const worker = async () => {
    while (i < entries.length) {
      const [url, from] = entries[i++];
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { range: "bytes=0-1023", "user-agent": UA },
          signal: AbortSignal.timeout(30000)
        });
        if (response.status >= 400) imageRows.push({ url, from, status: response.status });
      } catch {
        imageRows.push({ url, from, status: "取不到" });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/* ---- report ---- */
const bad = pages.filter((p) => p.status === 0 || p.status >= 400);
const slow = pages.filter((p) => p.status < 400 && p.ms > 4000).sort((a, b) => b.ms - a.ms);
const ok = pages.filter((p) => p.status >= 200 && p.status < 400);
const times = ok.map((p) => p.ms).sort((a, b) => a - b);

console.log(`  ${"─".repeat(74)}`);
console.log(`  走过 ${pages.length} 页：${ok.length} 正常，${bad.length} 打不开`);
if (times.length) {
  console.log(
    `  响应时间  中位 ${times[Math.floor(times.length / 2)]}ms   九成 ${times[Math.floor(times.length * 0.9)]}ms   最慢 ${times[times.length - 1]}ms`
  );
}
console.log(`  图片 ${images.size} 张，坏 ${imageRows.length} 张`);
console.log(`  ${"─".repeat(74)}`);

if (bad.length) {
  console.log(`\n  打不开的页面：`);
  for (const p of bad) console.log(`    ${String(p.status).padStart(3)}  ${decodeURIComponent(p.path).slice(0, 78)}${p.why ? "  " + p.why : ""}`);
}
if (imageRows.length) {
  console.log(`\n  坏图（最多列 20 张）：`);
  for (const r of imageRows.slice(0, 20)) {
    console.log(`    ${String(r.status).padStart(3)}  ${r.url.split("/").pop().slice(0, 50)}`);
    console.log(`         出现在 ${decodeURIComponent(r.from).slice(0, 62)}`);
  }
}
if (slow.length) {
  console.log(`\n  慢页（超过 4 秒，最多列 10 条）：`);
  for (const p of slow.slice(0, 10)) console.log(`    ${String(p.ms).padStart(6)}ms  ${decodeURIComponent(p.path).slice(0, 66)}`);
}
console.log("");
process.exit(bad.length || imageRows.length ? 1 : 0);
