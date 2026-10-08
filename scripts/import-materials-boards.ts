/**
 * Imports 展板与横幅 from the old site's /category/zxdzl/zbhf/.
 *
 *   npx tsx scripts/import-materials-boards.ts --dry-run
 *   npx tsx scripts/import-materials-boards.ts --apply
 *
 * ## Why a proxy
 *
 * Cloudflare serves the category listing to anyone but answers every *post*
 * under /YYYY/MM/DD/<id>/ with a challenge -- verified in one browser session
 * that loaded the listing and was then refused the post it linked to, so this
 * is a per-path rule rather than rate limiting. A headless browser does not get
 * through either.
 *
 * `r.jina.ai` reads the page and returns it as Markdown, which is the same
 * fallback `migrate-wp-posts.ts` already uses for this site. It gives the
 * title, the published time, the images and the download links -- everything a
 * material needs.
 *
 * Images are fetched directly (those are not challenged) and rehosted into our
 * Storage, so the pages do not depend on the old server.
 *
 * The post list is hardcoded. It was read off the rendered category page, which
 * is the only place that enumerates them -- the proxy truncates its listing and
 * the WordPress REST API is blocked outright.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

/**
 * The posts to import, by target category. Read off each rendered category
 * page, which is the only place that enumerates them -- the proxy truncates its
 * own listing and the WordPress REST API is blocked outright.
 *
 * /2022/09/14/686434/ (免翻墙链接) is deliberately absent from both: it appears
 * in those listings but is an access-tools post, not a material, and already
 * has a home at /resources/tools.
 */
const POSTS_BY_CATEGORY: Record<string, { url: string; slug: string }[]> = {
  // 展板横幅
  boards: [
    { url: "https://www.tuidang.org/2026/09/02/705731/", slug: "tuiguang-jiuping-xilie-zhanban" },
    { url: "https://www.tuidang.org/2026/08/28/705702/", slug: "shougang-nuesha-canan" },
    { url: "https://www.tuidang.org/2026/08/25/705664/", slug: "tuidang-zhengming-yilabao" },
    { url: "https://www.tuidang.org/2026/07/26/705388/", slug: "zhenxiang-zhanban-zifen-weian" },
    { url: "https://www.tuidang.org/2026/06/17/704911/", slug: "zhenxiang-zhanban-quan-ni-santui" },
    { url: "https://www.tuidang.org/2026/06/03/704671/", slug: "sankuan-zhenxiang-zhanban-tuidang-zhengshu" },
    { url: "https://www.tuidang.org/2026/04/23/703954/", slug: "zhenxiang-zhanban-2" },
    { url: "https://www.tuidang.org/2026/04/23/703949/", slug: "425-zhenxiang-zhanban" },
    { url: "https://www.tuidang.org/2026/04/22/703903/", slug: "jingdian-ziliao-yilabao" },
    { url: "https://www.tuidang.org/2026/04/20/703816/", slug: "zhenxiang-zhanban" }
  ],
  // 传单小册子
  leaflets: [
    { url: "https://www.tuidang.org/2026/06/15/704898/", slug: "gei-haiwai-huaren-canguan-laoban" },
    { url: "https://www.tuidang.org/2026/06/15/704891/", slug: "gei-haiwai-huaren-pengyou" },
    { url: "https://www.tuidang.org/2026/06/03/704798/", slug: "tuidang-zhengming-fangxin" },
    { url: "https://www.tuidang.org/2026/06/03/704684/", slug: "tuidang-zhengming-chuandan" },
    { url: "https://www.tuidang.org/2026/05/10/704295/", slug: "zhenxiang-chuandan-huozhai-qiguan" },
    { url: "https://www.tuidang.org/2026/05/02/704040/", slug: "zhenxiang-chuandan-daoyou" }
  ]
};

interface Parsed {
  title: string;
  publishedAt: string | null;
  images: string[];
  files: { label: string; url: string; kind: string }[];
  body: string;
}

/**
 * The page's own furniture, which appears on every post: the footer slogans,
 * 近期热点, 相关文章 and the 热门读物 book list. The real body sits between the
 * 【…讯】 dateline and the first of these.
 */
const CHROME_HEADINGS = ["## 天灭中共是必然", "## 携手共创美好未来", "## 欢迎订阅", "## 近期热点", "## 相关文章", "## 热门读物"];

function parse(markdown: string, images: string[]): Parsed {
  const title =
    markdown.match(/^Title:\s*(.+)$/m)?.[1]?.replace(/\s*-\s*全球退党服务中心\s*$/, "").trim() ?? "";
  const published = markdown.match(/^Published Time:\s*(.+)$/m)?.[1]?.trim() ?? "";

  // Past the marker, not up to it: a post without a 【…讯】 dateline would
  // otherwise keep "Markdown Content:" as the first line of its summary.
  const marker = "Markdown Content:";
  const markerAt = markdown.indexOf(marker);
  let body = markerAt >= 0 ? markdown.slice(markerAt + marker.length) : markdown;
  const dateline = body.indexOf("讯】");
  if (dateline >= 0) body = body.slice(dateline + 2);
  // Stop at the first piece of furniture.
  let cut = body.length;
  for (const heading of CHROME_HEADINGS) {
    const at = body.indexOf(heading);
    if (at >= 0 && at < cut) cut = at;
  }
  body = body.slice(0, cut);

  const files = Array.from(
    body.matchAll(/\[([^\]]{0,60})\]\((https?:\/\/[^)\s]+\.(pdf|zip|rar|docx?|ai|psd|mp3))\)/gi)
  ).map((m) => ({ label: m[1].trim(), url: m[2], kind: m[3].toUpperCase() }));

  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .split("\n")
    .map((line) => line.replace(/^[*\-\s#]+/, "").trim())
    .filter((line) => line && !/^浏览量|^\[post-views\]/.test(line))
    .join("\n");

  return {
    title,
    publishedAt: published ? new Date(published).toISOString() : null,
    images,
    files,
    body: text.slice(0, 1200)
  };
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const MD_CACHE = resolve(process.cwd(), "artifacts/materials-cache");
const HTML_CACHE = resolve(process.cwd(), "artifacts/materials-cache-html");

/**
 * Both caches are filled by scripts/warm scripts before this runs, because the
 * proxy rate-limits hard and a burst imports nothing.
 *
 * Two formats are needed. Markdown mode gives a clean title, published time and
 * body, but silently drops the board images -- they are lazy-loaded, so they
 * never reach its text extraction, and six of the ten posts came back with no
 * picture at all. HTML mode keeps them in `data-src`/`srcset`.
 */
function readCache(slug: string): { markdown: string; html: string } | null {
  const md = resolve(MD_CACHE, `${slug}.md`);
  const html = resolve(HTML_CACHE, `${slug}.html`);
  if (!existsSync(md) || !existsSync(html)) return null;
  return { markdown: readFileSync(md, "utf8"), html: readFileSync(html, "utf8") };
}

function imagesIn(html: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/(?:src|data-src|data-lazy-src|srcset)="([^"]*wp-content\/uploads[^"]*)"/g)) {
    const url = m[1].split(/[\s,]/)[0];
    if (!url || /logo|avatar|icon/i.test(url)) continue;
    if (!found.includes(url)) found.push(url);
  }
  return found;
}

/**
 * Site furniture, found by frequency rather than by a hardcoded list, so it
 * keeps working when the sidebar changes.
 *
 * Any image on more than one post. The threshold used to be `posts - 1` -- on
 * nearly every post -- which let the related-posts widget's thumbnail through:
 * it appeared on 13 of the 16 cached posts, under a threshold of 15, and was
 * imported into 13 materials as their last 高清图片.
 *
 * Two is right because the counts across the cache are cleanly split with
 * nothing in between: the sidebar images sit on all 16 posts, that widget's
 * thumbnail on 13, and every one of the 46 genuine board images on exactly one.
 * A board belongs to its own post; an image on two posts is page decoration.
 */
function chromeImages(all: Map<string, string[]>): Set<string> {
  const seen = new Map<string, number>();
  for (const images of all.values()) {
    for (const url of new Set(images)) seen.set(url, (seen.get(url) ?? 0) + 1);
  }
  return new Set(Array.from(seen.entries()).filter(([, n]) => n >= 2).map(([url]) => url));
}

function extensionOf(url: string, contentType: string): string {
  if (/jpe?g/i.test(contentType)) return "jpg";
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  const m = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

async function main() {
  loadEnvFileIfPresent(resolve(process.cwd(), ".env.local"));
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const categoryArg = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1] ?? "boards";
  const POSTS = POSTS_BY_CATEGORY[categoryArg];
  if (!POSTS) {
    throw new Error(`Unknown category "${categoryArg}". Known: ${Object.keys(POSTS_BY_CATEGORY).join(", ")}`);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: categories, error } = await supabase
    .from("cms_material_categories")
    .select("id, slug")
    .eq("slug", categoryArg)
    .maybeSingle();
  if (error) throw error;
  if (!categories) throw new Error(`No '${categoryArg}' category; run 017_materials.sql first`);
  const categoryId = categories.id as string;
  console.log(`importing into ${categoryArg} (${POSTS.length} posts)`);

  // Chrome is identified across the whole set, so every post must be read
  // before any of them can be parsed.
  const raw = new Map<string, { markdown: string; html: string }>();
  for (const post of POSTS) {
    const cached = readCache(post.slug);
    if (!cached) {
      console.log(`SKIP ${post.slug}: not cached (run the warm script first)`);
      continue;
    }
    raw.set(post.slug, cached);
  }
  if (raw.size === 0) throw new Error("No cached posts; nothing to import");

  // Across every cached post, not only this run's: the sidebar repeats on all
  // of them, and more samples make it unmistakable.
  const everyCached = new Map<string, string[]>();
  for (const file of readdirSync(HTML_CACHE)) {
    if (!file.endsWith(".html")) continue;
    everyCached.set(file, imagesIn(readFileSync(resolve(HTML_CACHE, file), "utf8")));
  }
  const chrome = chromeImages(everyCached);
  console.log(`${raw.size} posts cached; ${chrome.size} images identified as site furniture\n`);

  for (const post of POSTS) {
    const cached = raw.get(post.slug);
    if (!cached) continue;
    const boards = imagesIn(cached.html).filter((url) => !chrome.has(url));
    const parsed = parse(cached.markdown, boards);
    if (!parsed.title) {
      console.log(`SKIP ${post.slug}: no title`);
      continue;
    }
    if (parsed.images.length === 0 && parsed.files.length === 0) {
      // An empty material is worse than an absent one: it would show a card
      // with nothing behind it.
      console.log(`SKIP ${post.slug}: no board images and no files`);
      continue;
    }

    // The first image is the board itself; the rest are extra sheets, and each
    // is offered as its own download because that is what a reader wants.
    const rehosted: string[] = [];
    for (const [index, image] of parsed.images.entries()) {
      try {
        // The filenames are Chinese (看板_SL_A2-scaled.jpg), so the address has
        // to be encoded before it goes on the wire.
        const response = await fetch(encodeURI(image), { headers: { "user-agent": UA } });
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || contentType.startsWith("text/html")) throw new Error(`blocked (${response.status})`);
        const bytes = Buffer.from(await response.arrayBuffer());
        // Per-material folders, matching what the uploader writes and what
        // migrate-material-storage.ts moved everything to. A flat key here
        // would quietly undo that layout on every new import.
        const path = `materials/${post.slug}/${index + 1}.${extensionOf(image, contentType)}`;
        if (apply) {
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(path, bytes, { contentType, upsert: true });
          if (upErr) throw upErr;
        }
        rehosted.push(`${url}/storage/v1/object/public/${bucket}/${path}`);
      } catch (e) {
        console.log(`  ! image ${index + 1} not rehosted (${(e as Error).message}); keeping original`);
        rehosted.push(image);
      }
      await sleep(400);
    }

    const files = [
      // The high-resolution image is the download for most of these boards;
      // the old posts say so in as many words ("上圖是高清圖片，可以直接下載打印").
      ...rehosted.map((src, index) => ({
        label: rehosted.length > 1 ? `高清图片 ${index + 1}` : "高清图片",
        url: src,
        kind: "JPG"
      })),
      ...parsed.files
    ];

    const row = {
      slug: post.slug,
      locale: "zh",
      title: parsed.title,
      summary: parsed.body.split("\n")[0]?.slice(0, 120) ?? "",
      body_markdown: parsed.body,
      cover_image: rehosted[0] ?? "",
      cover_image_alt: parsed.title,
      files,
      status: "published",
      published_at: parsed.publishedAt,
      legacy_url: post.url
    };

    console.log(`\n${parsed.title}`);
    console.log(`  ${parsed.publishedAt?.slice(0, 10) ?? "(no date)"}  images=${rehosted.length}  files=${files.length}`);
    console.log(`  ${row.summary.slice(0, 70)}`);

    if (!apply) continue;

    const { data: saved, error: saveError } = await supabase
      .from("cms_materials")
      .upsert(row, { onConflict: "slug" })
      .select("id")
      .single();
    if (saveError) throw saveError;
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
