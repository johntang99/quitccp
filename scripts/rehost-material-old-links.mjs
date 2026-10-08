/**
 * Pulls the material downloads still served by tuidang.org into our Storage.
 *
 * Six material files still point at the old server. It goes away at the cutover
 * on 2026-10-09, and every one of them is a 404 the moment it does.
 *
 * Four are PDFs and fetch normally. The other two are .zip, which Cloudflare
 * answers with a 403 challenge page for every non-browser request -- the wall
 * `import-materials-promo.ts` documented and open-issues.md still tracks. A
 * cookie copied out of a real session is not enough either; the check looks at
 * more than cookies. They were pulled with a browser driving the download, and
 * this script picks them up from `artifacts/material-zips/` when they are
 * there. Anything it still cannot get is reported rather than guessed at.
 *
 *   node --env-file=.env.local scripts/rehost-material-old-links.mjs
 *   node --env-file=.env.local scripts/rehost-material-old-links.mjs --apply
 *   node --env-file=.env.local scripts/rehost-material-old-links.mjs --restore backups/mat-rehost-<stamp>.json
 */
import { createClient } from "@supabase/supabase-js";
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
    const { error } = await s.from("cms_materials").update({ files: c.beforeFiles }).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${b.changes.length} 份资料的文件链接`);
  process.exit(0);
}

const { data: materials, error } = await s.from("cms_materials").select("id,slug,title,files").order("slug");
if (error) throw error;

const jobs = [];
for (const m of materials) {
  for (const [index, f] of (m.files ?? []).entries()) {
    const url = String(f.url ?? "");
    if (!/tuidang\.org/i.test(url)) continue;
    jobs.push({ m, index, f, url, name: url.split("/").pop().split("?")[0] });
  }
}

console.log(`\n=== 还挂在旧站的文件 ${jobs.length} 个 ===\n`);
const fetched = [];
const blocked = [];
for (const j of jobs) {
  let ok = false;
  let size = 0;
  let buf = null;

  /* A copy fetched by hand with a browser, for the files Cloudflare blocks. */
  const local = path.join("artifacts", "material-zips", j.name);
  if (fs.existsSync(local)) {
    buf = fs.readFileSync(local);
    size = buf.length;
    const head = buf.subarray(0, 5).toString("binary");
    ok = head.startsWith("%PDF") || head.startsWith("PK");
    if (ok) {
      fetched.push({ ...j, buf, size, local: true });
      console.log(`  ✓ ${j.name.padEnd(34)} ${(size / 1024 / 1024).toFixed(1)} MB   ${j.m.title.slice(0, 22)}  （本地副本）`);
      continue;
    }
  }

  try {
    const res = await fetch(j.url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(180000) });
    if (res.ok) {
      buf = Buffer.from(await res.arrayBuffer());
      size = buf.length;
      /* A Cloudflare challenge answers 200 sometimes too -- the bytes decide. */
      const head = buf.subarray(0, 5).toString("binary");
      ok = head.startsWith("%PDF") || head.startsWith("PK");
    }
  } catch {
    /* reported as blocked below */
  }
  if (ok) {
    fetched.push({ ...j, buf, size });
    console.log(`  ✓ ${j.name.padEnd(34)} ${(size / 1024 / 1024).toFixed(1)} MB   ${j.m.title.slice(0, 22)}`);
  } else {
    blocked.push(j);
    console.log(`  ✗ ${j.name.padEnd(34)} 取不到      ${j.m.title.slice(0, 22)}`);
  }
}

if (blocked.length) {
  console.log(`\n  ${blocked.length} 个取不到 —— Cloudflare 对 .zip 的非浏览器请求一律 403。`);
  console.log(`  这几个要人工用浏览器下载后上传（open-issues.md 里本来就记着这件事）：`);
  for (const b of blocked) console.log(`     ${b.m.title.slice(0, 26)}  ${b.url}`);
}

if (!APPLY) {
  console.log(`\n  空跑 —— 没有写入。确认后加 --apply（会搬 ${fetched.length} 个）。`);
  process.exit(0);
}

const backup = { at: new Date().toISOString(), changes: [] };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `mat-rehost-${backup.at.replace(/[:.]/g, "-")}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));
save();

const byMaterial = new Map();
for (const f of fetched) {
  if (!byMaterial.has(f.m.id)) byMaterial.set(f.m.id, { m: f.m, items: [] });
  byMaterial.get(f.m.id).items.push(f);
}

for (const { m, items } of byMaterial.values()) {
  const files = structuredClone(m.files ?? []);
  for (const it of items) {
    const ext = it.name.split(".").pop().toLowerCase();
    const type = ext === "zip" ? "application/zip" : "application/pdf";
    const storagePath = `materials/${m.slug}/${it.name}`;
    const { error: upError } = await s.storage
      .from(BUCKET)
      .upload(storagePath, it.buf, { contentType: type, upsert: true });
    if (upError) throw upError;
    files[it.index] = { ...files[it.index], url: `${PUBLIC_BASE}${storagePath}` };
    console.log(`  ↑ ${storagePath}`);
  }
  backup.changes.push({ id: m.id, slug: m.slug, title: m.title, beforeFiles: m.files });
  save();
  const { error: updErr } = await s.from("cms_materials").update({ files }).eq("id", m.id);
  if (updErr) throw updErr;
}

console.log(`\n  已搬 ${fetched.length} 个文件，改了 ${backup.changes.length} 份资料`);
if (blocked.length) console.log(`  仍有 ${blocked.length} 个挂在旧站，见上面`);
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/rehost-material-old-links.mjs --restore ${file}`);
