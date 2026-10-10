/**
 * Finds the 大纪元 original of an article and restores its photographs.
 *
 *   node --env-file=.env.local scripts/recover-epochtimes-images.mjs [--apply] [--limit N]
 *
 * What is left after the Internet Archive pass: 2,588 images across 317
 * articles, nearly all of them 组图 rally reports whose old-site files are gone
 * and were never captured. The centre is a 大纪元 media partner and these
 * pieces ran there too, with the same photographs, still served from
 * i.epochtimes.com -- 5,490 of that host's images already sit in our bodies and
 * a sample of them was entirely healthy.
 *
 * The danger here is not failing to find them. It is finding the wrong ones:
 * attaching a photograph of one rally to the caption of another is worse than
 * showing a broken image, and nobody would ever notice. So the one rule this
 * script will not bend:
 *
 *   it rewrites an article only when 大纪元's copy carries exactly as many
 *   body photographs as our copy has broken ones.
 *
 * Same article, same count, same order -- then the nth is the nth. Any other
 * number and it reports the article and changes nothing, because a difference
 * in count means the two bodies are not the same sequence and position tells
 * us nothing. Articles that fail the gate are listed for a person to judge.
 *
 * The images stay on i.epochtimes.com rather than being copied into our
 * bucket, which is the rule `migrate-article-images.ts` already set: another
 * organisation's photographs are not ours to re-host.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i === -1 ? Infinity : Number(process.argv[i + 1]) || Infinity;
})();

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) throw new Error("缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const OUT = path.resolve("artifacts/image-recovery");
const BROKEN = /(?:!\[[^\]]*\]\(|<img[^>]+src=")(\/d\/file\/[^)"\s]+)/g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(45000) });
      if (res.ok) return await res.text();
      if (res.status === 404) return "";
    } catch {
      /* 重试 */
    }
    await sleep(attempt * 2500);
  }
  return "";
}

/**
 * Titles as they can actually be compared.
 *
 * The same report is filed under 《组图：…（图文）》 here and 《组图：…》 there,
 * with different punctuation and the occasional thousands separator. None of
 * that is part of the title; all of it defeats a plain equality test.
 */
function normalise(title) {
  return title
    .replace(/\s|　/g, "")
    .replace(/[（(][图文圖]{2}[)）]/g, "")
    .replace(/^组图[一二三四五六七八九十\d]*[：:]/, "")
    .replace(/^組圖[一二三四五六七八九十\d]*[：:]/, "")
    .replace(/[【】《》“”"'‘’：:，,、。.！!？?\-—－～~()（）\[\]]/g, "")
    .replace(/(\d),(\d)/g, "$1$2");
}

/** Character-bigram overlap; tolerant of a few edits, intolerant of a different event. */
function similar(a, b) {
  const grams = (s) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return shared / Math.min(A.size, B.size);
}

/**
 * The photographs in 大纪元's article body, in order, one entry each.
 *
 * Scoped to `#artbody` so the related-stories rail and the page furniture stay
 * out, and collapsed across the `-600x400` size variants the theme emits for
 * every picture -- without both of those the same 69-photograph report counts
 * as 138, and the exact-count gate below could never pass.
 */
function bodyImages(html) {
  const at = html.indexOf('id="artbody"');
  let body = at === -1 ? html : html.slice(at);
  const end = body.search(/<div[^>]+class="[^"]*(?:related|sidebar|footer|recommend)/i);
  if (end > 0) body = body.slice(0, end);

  const seen = new Set();
  const out = [];
  for (const m of body.matchAll(/https:\/\/i\.epochtimes\.com\/assets\/uploads\/[^"'\s)]+?\.(?:jpg|jpeg|png)/gi)) {
    const full = m[0].replace(/-\d+x\d+(\.[a-zA-Z]+)$/, "$1");
    if (!seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
  }
  return out;
}

async function readArticles() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPA}/rest/v1/cms_articles?select=id,title,body_markdown&order=id`, {
      headers: { ...H, Range: `${from}-${from + 999}`, "Range-Unit": "items" }
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return out;
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/* ---------------------------------------------------------------- */

console.log(`\n  ${APPLY ? "正式执行" : "试运行（不改任何东西；加 --apply 才动真格）"}\n`);

const all = await readArticles();
const targets = all
  .map((a) => ({ ...a, broken: [...(a.body_markdown ?? "").matchAll(BROKEN)].map((m) => m[1]) }))
  .filter((a) => a.broken.length > 0)
  .sort((a, b) => b.broken.length - a.broken.length)
  .slice(0, LIMIT);

console.log(`  还有坏图的文章 ${targets.length} 篇，共 ${targets.reduce((n, a) => n + a.broken.length, 0)} 张\n`);

const matched = [];
const countMismatch = [];
const notFound = [];

for (const [i, a] of targets.entries()) {
  const query = normalise(a.title).slice(0, 40) || a.title;
  const search = await get(`https://www.epochtimes.com/gb/search.htm?q=${encodeURIComponent(query)}`);
  const links = [...new Set([...search.matchAll(/https?:\/\/www\.epochtimes\.com\/gb\/\d+\/\d+\/\d+\/n\d+\.htm/g)].map((m) => m[0]))];

  let best = null;
  for (const link of links.slice(0, 3)) {
    const page = await get(link);
    if (!page) continue;
    const theirs = (page.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
    const score = similar(normalise(a.title), normalise(theirs.replace(/\s*\|\s*大纪元.*$/, "")));
    if (score >= 0.8) {
      best = { url: link, title: theirs, score, imgs: bodyImages(page) };
      break;
    }
    await sleep(500);
  }

  if (!best) notFound.push(a);
  else if (best.imgs.length !== a.broken.length) countMismatch.push({ a, best });
  else matched.push({ a, best });

  if ((i + 1) % 20 === 0) {
    process.stderr.write(`  …${i + 1}/${targets.length}  对上 ${matched.length}  数量不符 ${countMismatch.length}  找不到 ${notFound.length}\n`);
  }
  await sleep(700);
}

console.log(`\n  ${"─".repeat(70)}`);
console.log(`  数量正好相符，可以安全替换  ${matched.length} 篇，共 ${matched.reduce((n, m) => n + m.a.broken.length, 0)} 张`);
console.log(`  找到文章但图片数量对不上    ${countMismatch.length} 篇  ← 不动，留人判断`);
console.log(`  在大纪元上找不到对应文章    ${notFound.length} 篇`);
console.log(`  ${"─".repeat(70)}\n`);

mkdirSync(OUT, { recursive: true });
writeFileSync(
  path.join(OUT, "epochtimes-report.json"),
  JSON.stringify(
    {
      matched: matched.map((m) => ({ id: m.a.id, title: m.a.title, n: m.a.broken.length, source: m.best.url })),
      countMismatch: countMismatch.map((m) => ({ id: m.a.id, title: m.a.title, ours: m.a.broken.length, theirs: m.best.imgs.length, source: m.best.url })),
      notFound: notFound.map((a) => ({ id: a.id, title: a.title, n: a.broken.length }))
    },
    null,
    1
  )
);

if (!APPLY) {
  for (const m of matched.slice(0, 10)) {
    console.log(`  ✓ ${String(m.a.broken.length).padStart(3)} 张  《${m.a.title.slice(0, 34)}》`);
    console.log(`         ${m.best.url}`);
  }
  console.log(`\n  试运行结束，详细结果 artifacts/image-recovery/epochtimes-report.json`);
  console.log(`  加 --apply 才会改写正文。\n`);
  process.exit(0);
}

writeFileSync(
  path.join(OUT, "before-epochtimes.json"),
  JSON.stringify(matched.map((m) => ({ id: m.a.id, title: m.a.title, body_markdown: m.a.body_markdown })), null, 1)
);

let ok = 0;
const writeFailed = [];
for (const m of matched) {
  let body = m.a.body_markdown;
  m.a.broken.forEach((oldPath, index) => {
    body = body.split(oldPath).join(m.best.imgs[index]);
  });
  const res = await fetch(`${SUPA}/rest/v1/cms_articles?id=eq.${m.a.id}`, {
    method: "PATCH",
    headers: { ...H, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ body_markdown: body })
  });
  if (res.ok) {
    ok += 1;
    console.log(`  ✓ ${String(m.a.broken.length).padStart(3)} 张  《${m.a.title.slice(0, 38)}》`);
  } else {
    writeFailed.push({ id: m.a.id, title: m.a.title, status: res.status });
  }
}

console.log(`\n  改写 ${ok} 篇${writeFailed.length ? `，失败 ${writeFailed.length} 篇` : ""}`);
console.log(`  回滚用 artifacts/image-recovery/before-epochtimes.json\n`);
