/**
 * Removes the 特別報導 banner that was imported as a board image, and restores
 * the three downloads the importer never saw.
 *
 * `scripts/import-materials-boards.ts` filters out site furniture by frequency:
 * an image on nearly every post belongs to the sidebar, not to the board. Its
 * threshold was `max(2, posts - 1)` -- with 16 posts cached, an image had to
 * appear in 15 of them. The related-posts widget's thumbnail
 * (特別報導_signal-2025-12-01-142108.jpeg) appears in 13, so it came through as
 * content and was copied into 13 materials as their last 高清图片.
 *
 * The cached HTML shows the counts are cleanly split, with nothing in between:
 * 8 images appear in all 16 posts, this one in 13, and the 46 real board images
 * in exactly 1 each. So "in more than one post" is the rule that matches the
 * data, and the fix to the importer is a one-line threshold change.
 *
 * Two posts also carry their download as a Google Drive link rather than an
 * href to a .pdf, which the importer does not look for -- so 【真相传单】指证
 * 中共活摘器官 ended up with no file of its own at all, only the banner. The
 * three PDFs are fetched into Storage rather than linked, same as every other
 * material's files.
 *
 *   node --env-file=.env.local scripts/fix-material-chrome-image.mjs
 *   node --env-file=.env.local scripts/fix-material-chrome-image.mjs --apply
 *   node --env-file=.env.local scripts/fix-material-chrome-image.mjs --restore backups/mat-chrome-<stamp>.json
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
    const patch = { files: c.beforeFiles };
    if (c.beforeCover !== undefined) patch.cover_image = c.beforeCover;
    const { error } = await s.from("cms_materials").update(patch).eq("id", c.id);
    if (error) throw error;
  }
  console.log(`  已还原 ${b.changes.length} 份资料`);
  console.log(`  （上传到 Storage 的文件留着没删，不影响还原后的页面）`);
  process.exit(0);
}

/** The banner, by its byte content -- the filename differs per material. */
const CHROME_SHA1 = "c03bdd75d4bb";

/** Downloads the old site offered as Google Drive links. */
const DRIVE = {
  "zhenxiang-chuandan-huozhai-qiguan": [
    { id: "1_Op4Iyo3QWMhkw7a1dCcSFWSpbkhkAd6", label: "傳單（PDF）", name: "chengpeiming-flyer.pdf", cover: true }
  ],
  "zhenxiang-chuandan-daoyou": [
    { id: "19KPQQVgxIAkwSGlvE_RDvdiaZJc4q1_K", label: "印刷廠版（PDF，長邊翻頁）", name: "daoyou-print.pdf" },
    { id: "1rXn9fv-FmqYX-IYR14AFyJJ0wkkEbvDc", label: "普通打印機版（PDF，短邊翻頁）", name: "daoyou-home-print.pdf" }
  ]
};

const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const { data: materials, error } = await s
  .from("cms_materials")
  .select("id,slug,title,cover_image,files")
  .order("slug");
if (error) throw error;

/* Each image is fetched and hashed: the banner sits at a different filename in
   every material, so only its bytes identify it. */
const plan = [];
for (const m of materials) {
  const files = Array.isArray(m.files) ? m.files : [];
  const kept = [];
  const dropped = [];
  for (const f of files) {
    const url = String(f.url ?? "");
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(url)) {
      kept.push(f);
      continue;
    }
    let isChrome = false;
    try {
      isChrome = sha(await fetchBuffer(url)) === CHROME_SHA1;
    } catch {
      /* unreachable image: leave it alone rather than guess */
    }
    if (isChrome) dropped.push(f);
    else kept.push(f);
  }

  let coverIsChrome = false;
  if (m.cover_image) {
    try {
      coverIsChrome = sha(await fetchBuffer(m.cover_image)) === CHROME_SHA1;
    } catch {
      /* ignore */
    }
  }

  const drive = DRIVE[m.slug] ?? [];
  if (dropped.length === 0 && !coverIsChrome && drive.length === 0) continue;
  plan.push({ m, kept, dropped, coverIsChrome, drive });
}

console.log(`\n=== 共 ${materials.length} 份资料，需要改的 ${plan.length} 份 ===\n`);
for (const p of plan) {
  console.log(`  ${p.m.title.slice(0, 34)}`);
  for (const d of p.dropped) {
    console.log(`     ✗ 删掉 ${d.label}  ${String(d.url).split("/").slice(-2).join("/")}`);
  }
  if (p.coverIsChrome) console.log(`     ✗ 封面也是这张banner，要换掉`);
  for (const d of p.drive) console.log(`     ＋ 补上 ${d.label}（旧站用的是 Google Drive 链接）`);
  console.log(`     文件数 ${(p.m.files ?? []).length} → ${p.kept.length + p.drive.length}`);
  console.log("");
}

if (!APPLY) {
  console.log("  空跑 —— 没有写入。确认后加 --apply。");
  process.exit(0);
}

const backup = { at: new Date().toISOString(), changes: [] };
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `mat-chrome-${backup.at.replace(/[:.]/g, "-")}.json`);
const save = () => fs.writeFileSync(file, JSON.stringify(backup, null, 2));
save();

for (const p of plan) {
  const files = [...p.kept];
  let cover = p.m.cover_image;

  for (const d of p.drive) {
    const buf = await fetchBuffer(`https://drive.google.com/uc?export=download&id=${d.id}`);
    if (buf.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error(`${d.name} 拿回来的不是 PDF，先别写`);
    }
    const storagePath = `materials/${p.m.slug}/${d.name}`;
    const { error: upError } = await s.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: "application/pdf", upsert: true });
    if (upError) throw upError;
    files.push({ url: `${PUBLIC_BASE}${storagePath}`, kind: "PDF", label: d.label });
    console.log(`  ↑ ${d.name} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);

    /* The flyer has no board image anywhere on the old post, so its own first
       page becomes the preview -- rendered beforehand, read from disk here. */
    if (d.cover) {
      const rendered = `${process.env.MATERIAL_COVER_DIR ?? "artifacts/material-covers"}/${p.m.slug}.jpg`;
      if (fs.existsSync(rendered)) {
        const img = fs.readFileSync(rendered);
        const coverPath = `materials/${p.m.slug}/cover.jpg`;
        const { error: cErr } = await s.storage
          .from(BUCKET)
          .upload(coverPath, img, { contentType: "image/jpeg", upsert: true });
        if (cErr) throw cErr;
        cover = `${PUBLIC_BASE}${coverPath}`;
        console.log(`  ↑ ${p.m.slug}/cover.jpg（取自 PDF 第一页）`);
      }
    }
  }

  backup.changes.push({
    id: p.m.id,
    slug: p.m.slug,
    title: p.m.title,
    beforeFiles: p.m.files,
    beforeCover: p.m.cover_image
  });
  save();

  const patch = { files };
  if (cover !== p.m.cover_image) patch.cover_image = cover;
  const { error: upErr } = await s.from("cms_materials").update(patch).eq("id", p.m.id);
  if (upErr) throw upErr;
}

/* The banner's copies in Storage are now referenced by nothing. */
let removed = 0;
for (const p of plan) {
  for (const d of p.dropped) {
    const rel = String(d.url).split(`/public/${BUCKET}/`)[1]?.split("?")[0];
    if (!rel || !rel.startsWith("materials/")) continue;
    const { error: delErr } = await s.storage.from(BUCKET).remove([rel]);
    if (!delErr) removed += 1;
  }
}

console.log(`\n  已改 ${backup.changes.length} 份资料，删掉 Storage 里 ${removed} 个 banner 副本`);
console.log(`\n  备份：${file}`);
console.log(`  撤销：node --env-file=.env.local scripts/fix-material-chrome-image.mjs --restore ${file}`);
