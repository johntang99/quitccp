/**
 * Seeds 真相点资料 from the old site's /td_promo/ page.
 *
 *   npx tsx scripts/import-materials-promo.ts --dry-run
 *   npx tsx scripts/import-materials-promo.ts --apply
 *
 * Five materials, each with a preview image and one download. They are
 * transcribed rather than scraped live: /td_promo/ is a hand-built Elementor
 * page, not a feed, and it has changed twice in two years. The URLs below were
 * read off the page and each one checked.
 *
 * ## What gets rehosted and what does not
 *
 * Preview images and the PDF are pulled into our own Storage, so the pages do
 * not depend on the old server and do not announce a reader to it.
 *
 * The .zip files are left pointing at tuidang.org. Cloudflare answers every
 * non-browser request for a .zip with a 403 challenge page -- verified with
 * curl and with a real Chromium session that had already cleared the challenge
 * on the HTML page -- so this script cannot fetch them. A reader clicking the
 * link in their own browser passes the challenge normally, so the downloads
 * work; they are simply still served by the old server. Copying those five
 * files off that server by hand is the fix, the same as the .mp4 archive in
 * open-issues.md.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFileIfPresent(filePath: string) {
  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // optional
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

const UPLOADS = "https://www.tuidang.org/wp-content/uploads";

interface Seed {
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  /** Preview image on the old site; rehosted. */
  image: string;
  files: { label: string; url: string; kind: string; rehost?: boolean }[];
}

const SEEDS: Seed[] = [
  {
    slug: "santui-dengjibiao",
    title: "三退登记表",
    summary: "义工现场使用的纸本登记表，供无法在线提交声明的人填写，可直接打印。",
    body: "服务点义工现场使用的纸本三退登记表。适合无法或不便在线提交声明的人现场填写，由义工代为提交。A4 打印即可使用。",
    category: "leaflets",
    image: `${UPLOADS}/2024/07/td_form.jpeg`,
    files: [
      { label: "三退登记表（PDF）", url: `${UPLOADS}/2024/07/${encodeURIComponent("三退登记表")}.pdf`, kind: "PDF", rehost: true }
    ]
  },
  {
    slug: "santui-baopingan-chuandan-2024",
    title: "三退保平安传单（2024 版）",
    summary: "2024 新版三退传单，含印刷版 PDF 正反两面与 A4 图片版。",
    body: "2024 新版三退传单。包括：印刷版 PDF 正反两面，可用于印刷厂批量打印；以及 A4 尺寸的图片版本，便于自行打印与转发。",
    category: "leaflets",
    image: `${UPLOADS}/2024/07/td_flyer_2024.jpeg`,
    files: [{ label: "传单套件（ZIP）", url: `${UPLOADS}/2024/07/td_flyer_2024.zip`, kind: "ZIP" }]
  },
  {
    slug: "santui-shoujupai-2jiantao",
    title: "三退手举牌（2 件套）",
    summary: "可自行打印、塑封的手举牌套件，含三退保平安手举牌与带填写范例的登记表。",
    body: "可自行打印、塑封使用。包括：1. 三退保平安手举牌；2. 带有填写范例的三退登记表。",
    category: "placards",
    image: `${UPLOADS}/2024/07/td_hand_hold_board.jpeg`,
    files: [{ label: "手举牌套件（ZIP）", url: `${UPLOADS}/2024/07/td_hand_hold_board_sets.zip`, kind: "ZIP" }]
  },
  {
    slug: "xuanze-yu-jiushu",
    title: "《选择与救赎》",
    summary: "真相小册子。「善恶选择一念间，命运未来两重天。」",
    body: "善恶选择一念间，命运未来两重天。\n\n机缘难遇稍纵逝，明鉴是非保平安。",
    category: "leaflets",
    image: `${UPLOADS}/2025/01/zxxcz_xzyjs.jpg`,
    files: [{ label: "小册子（ZIP）", url: `${UPLOADS}/2025/01/xzyjs.zip`, kind: "ZIP" }]
  },
  {
    slug: "lishi-chongyan-jingrenxing",
    title: "《历史重演惊人醒》",
    summary: "真相小册子。「以人为镜，可明得失；以史为镜，可知兴替。」",
    body: "以人为镜，可明得失；以史为镜，可知兴替。\n\n历史的教训总是在一次次重演中，警醒着后人。",
    category: "leaflets",
    image: `${UPLOADS}/2025/01/zxxcz_lscyjrx.jpg`,
    files: [{ label: "小册子（ZIP）", url: `${UPLOADS}/2025/01/lscyjrx.zip`, kind: "ZIP" }]
  }
];

function extensionOf(url: string, contentType: string): string {
  if (/jpe?g/i.test(contentType)) return "jpg";
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/pdf/i.test(contentType)) return "pdf";
  const m = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "bin";
}

async function main() {
  const cwd = process.cwd();
  loadEnvFileIfPresent(resolve(cwd, ".env.local"));

  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: categories, error: catError } = await supabase
    .from("cms_material_categories")
    .select("id, slug, name");
  if (catError) throw catError;
  const categoryBySlug = new Map((categories ?? []).map((row) => [row.slug as string, row.id as string]));

  /** Pulls one asset into our Storage and returns its public URL. */
  async function rehost(sourceUrl: string, objectPath: string): Promise<string> {
    const response = await fetch(sourceUrl, { headers: { "user-agent": UA }, redirect: "follow" });
    if (!response.ok) throw new Error(`${response.status} fetching ${sourceUrl}`);
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (contentType.startsWith("text/html")) {
      // Cloudflare's challenge page, not the file.
      throw new Error(`blocked (challenge page) for ${sourceUrl}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const path = `${objectPath}.${extensionOf(sourceUrl, contentType)}`;
    if (apply) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) throw error;
    }
    return `${url}/storage/v1/object/public/${bucket}/${path}`;
  }

  for (const seed of SEEDS) {
    const categoryId = categoryBySlug.get(seed.category);
    if (!categoryId) {
      console.log(`SKIP ${seed.slug}: no category ${seed.category}`);
      continue;
    }

    let cover = "";
    try {
      cover = await rehost(seed.image, `materials/${seed.slug}-cover`);
    } catch (error) {
      console.log(`  ! cover not rehosted (${(error as Error).message}); keeping the original URL`);
      cover = seed.image;
    }

    const files: { label: string; url: string; kind: string }[] = [];
    for (const file of seed.files) {
      let fileUrl = file.url;
      if (file.rehost) {
        try {
          fileUrl = await rehost(file.url, `materials/${seed.slug}-${file.kind.toLowerCase()}`);
        } catch (error) {
          console.log(`  ! ${file.label} not rehosted (${(error as Error).message}); keeping the original URL`);
        }
      }
      files.push({ label: file.label, url: fileUrl, kind: file.kind });
    }

    const row = {
      slug: seed.slug,
      locale: "zh",
      title: seed.title,
      summary: seed.summary,
      body_markdown: seed.body,
      cover_image: cover,
      cover_image_alt: seed.title,
      files,
      status: "published",
      published_at: new Date().toISOString(),
      legacy_url: "https://www.tuidang.org/td_promo/"
    };

    console.log(`\n${seed.title}`);
    console.log(`  category ${seed.category}`);
    console.log(`  cover    ${cover.slice(0, 96)}`);
    files.forEach((f) => console.log(`  file     ${f.label} -> ${f.url.slice(0, 86)}`));

    if (!apply) continue;

    const { data: saved, error } = await supabase
      .from("cms_materials")
      .upsert(row, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw error;

    const { error: mapError } = await supabase
      .from("cms_material_category_map")
      .upsert({ material_id: saved.id, category_id: categoryId, position: 0 });
    if (mapError) throw mapError;
  }

  console.log(apply ? "\napplied" : "\n--dry-run: nothing written (pass --apply)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
