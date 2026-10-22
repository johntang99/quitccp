/**
 * 把已有英文站的影片搬进来。
 *
 *     npm run import:en:videos                 # 预演
 *     npm run import:en:videos -- --apply
 *
 * ## 这些影片是什么
 *
 * global.tuidang.org 的 Video Post 分类有 36 篇，其中 33 篇是《铁证如山》
 * 英文版讲座（Episode 1–32），MP4 托管在追查国际自己的服务器上。那是一套
 * 完整的、真实的英文影片，不是样例 —— 正好对上建站时播下的 ironclad 分类。
 *
 * ## 分类按实际内容来，不按理想结构
 *
 * 建站时照着中文站播了 14 个英文视频分类。实际有内容的只有一个。空分类
 * 留着会在 /videos 的标签栏里显示成一排点进去什么都没有的栏目 —— 和文章
 * 分类那次一样，跑完会把没有影片的删掉。
 *
 * 另外两三支零散的，归到一个 others 分类下，省得为一支片子单开一栏。
 *
 * ## 取舍
 *
 * 影片直接引用追查国际的 MP4 地址，封面引用旧站的图 —— 和文章那次一样，
 * 演示够用，真上线要搬进自己的存储。
 *
 * 集数从标题里认（"Episode 12: ..."），认不出就留空：编一个集数比没有集数糟。
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = "https://global.tuidang.org";
const PROXY = "https://r.jina.ai/";
/** Video Post —— 这个站放影片的分类。 */
const VIDEO_CATEGORY_ID = 4620;

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* 可选文件。 */
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${PROXY}${SOURCE}/wp-json/wp/v2/${path}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      const text = await res.text();
      const start = text.search(/[[{]"?/);
      if (start < 0) throw new Error("响应里找不到 JSON");
      const close = text[start] === "[" ? "]" : "}";
      const end = text.lastIndexOf(close);
      if (end <= start) throw new Error("JSON 不完整");
      const parsed = JSON.parse(text.slice(start, end + 1)) as T;
      if (!Array.isArray(parsed)) throw new Error("等一个数组");
      return parsed;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error("取不到");
}

/**
 * 简介里把「Video Download Link + 一串 mp4 地址」剥掉。
 *
 * 这套片子的正文开头是五个清晰度的下载直链，摘要就从那儿截。结果首页推荐位
 * 的简介是一长串 https://…2160p.mp4https://…1440p.mp4 —— 读者看到的是一堆
 * 地址，而真正的内容简介（Executive Summary）被挤到后面看不见。
 *
 * 剥掉之后从 Executive Summary 那句开始，正是这一集讲什么。
 */
function stripDownloadLinks(text: string): string {
  return text
    .replace(/Video\s*Download\s*Link/gi, " ")
    .replace(/https?:\/\/\S+?\.mp4/gi, " ")
    .replace(/^\s*Executive\s*Summary\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&hellip;/g, "…").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—")
    .replace(/\s+/g, " ").trim();
}

/** 片源：MP4 直链优先，其次 YouTube，再次干净世界。 */
function sourceOf(html: string): string {
  const mp4 = html.match(/https?:\/\/[^"'\s<)]+\.mp4/);
  if (mp4) return mp4[0];
  const yt = html.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const gj = html.match(/https?:\/\/(?:www\.)?ganjingworld\.com\/[^"'\s<)]+/);
  return gj ? gj[0] : "";
}

/** 「Episode 12: ...」里的集数。认不出就留空。 */
function episodeOf(title: string): string {
  const m = title.match(/^Episode\s+(\d+)/i);
  return m ? m[1] : "";
}

interface WpPost {
  id: number; date: string; slug: string; link: string;
  title: { rendered: string }; content: { rendered: string }; excerpt: { rendered: string };
  _embedded?: { "wp:featuredmedia"?: { source_url?: string; alt_text?: string }[] };
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));
  const apply = process.argv.includes("--apply");
  const locale = "en";

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n========== 从 ${SOURCE} 搬影片${apply ? "" : "（预演）"} ==========\n`);

  const posts = await fetchJson<WpPost[]>(
    `posts?per_page=100&categories=${VIDEO_CATEGORY_ID}&orderby=date&order=desc&_embed=wp:featuredmedia`
  );
  console.log(`  Video Post：${posts.length} 篇`);

  const rows = posts
    .map((p) => {
      const html = p.content.rendered;
      const src = sourceOf(html);
      const media = p._embedded?.["wp:featuredmedia"]?.[0];
      const title = plain(p.title.rendered);
      /*
       * 《铁证如山》那一套单独成栏，其余归到 others。
       * 判据用片源地址里的 tzrs（追查国际给这套片子的目录名），比用标题稳 ——
       * 标题的写法这些年变过（Episode 23 有冒号，Episode 24 没有）。
       */
      const isIronclad = /\/tzrs\//i.test(src) || /^Episode\s+\d+/i.test(title);
      return {
        row: {
          slug: p.slug,
          locale,
          title,
          description: stripDownloadLinks(plain(p.excerpt.rendered))
            .replace(/\s*\[?…\]?$/, "")
            .slice(0, 600),
          body_markdown: "",
          source_url: src,
          backup_url: "",
          cover_image: media?.source_url ?? "",
          cover_image_alt: plain(media?.alt_text ?? ""),
          episode: episodeOf(title),
          speaker: "",
          source_credit: "",
          status: "published",
          featured: false,
          editor_archive: false,
          published_at: new Date(p.date).toISOString(),
          legacy_url: new URL(p.link).pathname,
          platform_ids: {}
        },
        category: isIronclad ? "ironclad" : "others"
      };
    })
    .filter((x) => {
      if (!x.row.source_url) console.log(`     － 跳过（找不到片源）：${x.row.title.slice(0, 50)}`);
      return Boolean(x.row.source_url);
    });

  const byCat = new Map<string, number>();
  for (const x of rows) byCat.set(x.category, (byCat.get(x.category) ?? 0) + 1);
  console.log(`\n  可搬 ${rows.length} 支：`);
  for (const [k, n] of byCat) console.log(`     ${String(n).padStart(3)} 支  ${k}`);
  console.log(`     有封面 ${rows.filter((x) => x.row.cover_image).length} 支`);
  console.log(`\n  样例：`);
  for (const x of rows.slice(0, 3)) {
    console.log(`     ${x.row.published_at.slice(0, 10)}  ${x.row.title.slice(0, 56)}`);
    console.log(`        ${x.row.source_url.slice(0, 76)}`);
  }

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    return;
  }

  /* 分类：只建真正用到的那两个。 */
  const cats = [
    { slug: "ironclad", name: "Ironclad Evidence", sort_order: 10, locale,
      description: "The filmed editions of the WOIPFG investigations, in English." },
    { slug: "others", name: "Other programmes", sort_order: 900, locale,
      description: "Everything that does not belong to one of the series above." }
  ].filter((c) => byCat.has(c.slug));

  const { error: catError } = await db
    .from("cms_video_categories")
    .upsert(cats, { onConflict: "slug,locale" });
  if (catError) throw new Error(`分类写失败：${catError.message}`);
  console.log(`\n  ✓ 分类 ${cats.length} 个`);

  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await db
      .from("cms_videos")
      .upsert(rows.slice(i, i + 50).map((x) => x.row), { onConflict: "slug,locale" });
    if (error) throw new Error(`影片写失败：${error.message}`);
  }
  console.log(`  ✓ 影片 ${rows.length} 支`);

  const { data: savedCats } = await db
    .from("cms_video_categories").select("id, slug").eq("locale", locale);
  const catId = new Map((savedCats ?? []).map((c) => [String(c.slug), String(c.id)]));
  const { data: savedVideos } = await db
    .from("cms_videos").select("id, slug").eq("locale", locale);
  const vidId = new Map((savedVideos ?? []).map((v) => [String(v.slug), String(v.id)]));

  const maps = rows
    .map((x) => ({ video_id: vidId.get(x.row.slug), category_id: catId.get(x.category), position: 0 }))
    .filter((m) => m.video_id && m.category_id) as { video_id: string; category_id: string; position: number }[];
  const { error: mapError } = await db
    .from("cms_video_category_map").upsert(maps, { onConflict: "video_id,category_id" });
  if (mapError) throw new Error(`分类关联写失败：${mapError.message}`);
  console.log(`  ✓ 分类关联 ${maps.length} 条`);

  /* 空分类删掉 —— 建站时照中文站播的那 14 个，一支影片都没有。 */
  const { data: empty } = await db
    .from("cms_video_categories").select("id, slug, name").eq("locale", locale);
  const used = new Set(maps.map((m) => m.category_id));
  const toDrop = (empty ?? []).filter((c) => !used.has(String(c.id)));
  if (toDrop.length > 0) {
    console.log(`\n  没有影片的分类 ${toDrop.length} 个，删掉：`);
    for (const c of toDrop) console.log(`     ${String(c.slug).padEnd(28)} ${c.name}`);
    const { error } = await db
      .from("cms_video_categories").delete().in("id", toDrop.map((c) => c.id));
    if (error) throw new Error(`删空分类失败：${error.message}`);
  }

  console.log("\n✓ 搬完了。\n");
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
