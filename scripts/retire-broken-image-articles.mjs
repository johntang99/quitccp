/**
 * Clears the last of the broken article photographs, two ways.
 *
 *   node --env-file=.env.local scripts/retire-broken-image-articles.mjs [--apply]
 *
 * After the archive and 大纪元 passes, 204 published articles still carry an
 * image that does not load. They split cleanly, and the split decides what
 * happens to each:
 *
 *   - 154 where *every* photograph is gone. These are 组图 rally reports whose
 *     content was the pictures; what is left is a headline and a caption list.
 *     Deleted outright, at the owner's instruction.
 *
 *     Deletion is the one step here that cannot be undone from the admin, so
 *     the whole row goes to artifacts/ first -- body, metadata, and the
 *     category and tag ids, which the database drops on cascade and which a
 *     bare row would not be enough to rebuild. The backup is written and read
 *     back before a single article is removed.
 *
 *   - 50 where some load and some do not. These stay published and simply lose
 *     the dead pictures. One of them is a 70-photograph report missing a single
 *     decorative badge; retiring it over that would be the wrong trade.
 *
 * Only the image syntax is removed, never the surrounding text. A caption whose
 * photograph has gone is a loose line; a paragraph deleted because it sat near
 * an image is lost reporting, and no one would know to look for it.
 *
 * Both halves write their previous state to artifacts/ before touching
 * anything.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) throw new Error("缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };
const OUT = path.resolve("artifacts/image-recovery");
const SCRATCH = "/private/tmp/claude-501/-Users-johntang-Desktop-clients-quitccp/44cb217e-1b39-4085-a3ad-7626d93a39c2/scratchpad";

const IMG = /(?:!\[[^\]]*\]\(([^)\s]+)[^)]*\)|<img[^>]+src="([^"]+)"[^>]*>)/g;
const badExternal = new Set(Object.keys(JSON.parse(readFileSync(path.join(SCRATCH, "bad-ext-final.json"), "utf8"))));
const isBroken = (url) => url.startsWith("/d/file/") || badExternal.has(url);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Take out one image, and the blank line it was sitting on.
 *
 * Images here are their own paragraph, so deleting the syntax alone leaves a
 * run of empty lines that Markdown renders as a gap. The blank-line collapse
 * at the end is what keeps the article from developing holes.
 */
function removeImage(body, url) {
  const u = escape(url);
  return body
    .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*${u}[^)]*\\)`, "g"), "")
    .replace(new RegExp(`<img[^>]+src="${u}"[^>]*>`, "g"), "");
}

async function readPublished() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPA}/rest/v1/cms_articles?select=id,title,slug,status,body_markdown&status=eq.published&order=id`, {
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

const published = await readPublished();
const retire = [];
const clean = [];

for (const a of published) {
  const urls = [...new Set([...(a.body_markdown ?? "").matchAll(IMG)].map((m) => m[1] ?? m[2]))];
  if (urls.length === 0) continue;
  const broken = urls.filter(isBroken);
  if (broken.length === 0) continue;
  if (broken.length === urls.length) retire.push({ ...a, broken });
  else clean.push({ ...a, broken });
}

console.log(`  已发布 ${published.length} 篇`);
console.log(`    整篇图全坏 → 删除        ${retire.length} 篇`);
console.log(`    部分图坏   → 摘掉坏图    ${clean.length} 篇（共摘 ${clean.reduce((n, a) => n + a.broken.length, 0)} 个地址）\n`);

if (!APPLY) {
  console.log("  将被删除的，前 8 篇：");
  for (const a of retire.sort((x, y) => y.broken.length - x.broken.length).slice(0, 8)) {
    console.log(`    ${String(a.broken.length).padStart(3)} 张全坏  《${a.title.slice(0, 40)}》`);
  }
  console.log("\n  将被清理的，前 8 篇：");
  for (const a of clean.slice(0, 8)) {
    const before = a.body_markdown.length;
    let after = a.body_markdown;
    for (const u of a.broken) after = removeImage(after, u);
    after = after.replace(/\n{3,}/g, "\n\n");
    console.log(`    摘 ${String(a.broken.length).padStart(2)} 个  正文 ${before} → ${after.length} 字  《${a.title.slice(0, 34)}》`);
  }
  console.log(`\n  试运行结束。加 --apply 才会改。\n`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  path.join(OUT, "before-clean.json"),
  JSON.stringify(clean.map((a) => ({ id: a.id, title: a.title, body_markdown: a.body_markdown })), null, 1)
);
console.log(`  清理前的正文已存到 artifacts/image-recovery/before-clean.json\n`);

/* ---- 一、删除（先备份到能还原为止，再动手） ---- */
const ids = retire.map((a) => a.id);
const full = [];
for (let i = 0; i < ids.length; i += 40) {
  const chunk = ids.slice(i, i + 40);
  const [rows, cats, tags] = await Promise.all([
    fetch(`${SUPA}/rest/v1/cms_articles?id=in.(${chunk.join(",")})&select=*`, { headers: H }).then((r) => r.json()),
    fetch(`${SUPA}/rest/v1/cms_article_category_map?article_id=in.(${chunk.join(",")})&select=*`, { headers: H }).then((r) => r.json()),
    fetch(`${SUPA}/rest/v1/cms_article_tag_map?article_id=in.(${chunk.join(",")})&select=*`, { headers: H }).then((r) => r.json())
  ]);
  for (const row of rows) {
    full.push({
      article: row,
      categories: cats.filter((c) => c.article_id === row.id),
      tags: tags.filter((t) => t.article_id === row.id)
    });
  }
}

const backupFile = path.join(OUT, "deleted-articles.json");
writeFileSync(backupFile, JSON.stringify(full, null, 1));

/* Read it back before deleting anything. A backup that was never verified is
   a note saying a backup was taken. */
const verify = JSON.parse(readFileSync(backupFile, "utf8"));
if (verify.length !== retire.length || verify.some((v) => !v.article?.id || typeof v.article.body_markdown !== "string")) {
  console.error(`  ✗ 备份核对不过（备到 ${verify.length} 篇，应为 ${retire.length} 篇），一篇都不删。`);
  process.exit(1);
}
console.log(`  备份 ${verify.length} 篇完整记录到 ${path.relative(process.cwd(), backupFile)}，已读回核对 ✓`);

let deleted = 0;
const deleteFailed = [];
for (let i = 0; i < ids.length; i += 50) {
  const chunk = ids.slice(i, i + 50);
  const res = await fetch(`${SUPA}/rest/v1/cms_articles?id=in.(${chunk.join(",")})`, {
    method: "DELETE",
    headers: { ...H, Prefer: "return=minimal" }
  });
  if (res.ok) deleted += chunk.length;
  else deleteFailed.push({ from: i, status: res.status, detail: (await res.text()).slice(0, 140) });
}
console.log(`  删除 ${deleted}/${retire.length} 篇${deleteFailed.length ? `，失败批次 ${deleteFailed.length}` : ""}`);

/* ---- 二、摘掉坏图 ---- */
let cleaned = 0;
const cleanFailed = [];
for (const a of clean) {
  let body = a.body_markdown;
  for (const url of a.broken) body = removeImage(body, url);
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  const res = await fetch(`${SUPA}/rest/v1/cms_articles?id=eq.${a.id}`, {
    method: "PATCH",
    headers: { ...H, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ body_markdown: body })
  });
  if (res.ok) cleaned += 1;
  else cleanFailed.push({ id: a.id, title: a.title, status: res.status });
}
console.log(`  清理 ${cleaned}/${clean.length} 篇${cleanFailed.length ? `，失败 ${cleanFailed.length} 篇` : ""}\n`);

writeFileSync(path.join(OUT, "retire-report.json"), JSON.stringify({ deleteFailed, cleanFailed }, null, 1));
