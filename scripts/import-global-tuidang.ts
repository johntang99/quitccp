/**
 * 把已有英文站 global.tuidang.org 的内容搬进来，用于给英文编辑看一个「活的站」。
 *
 *     npm run import:en                    # 预演
 *     npm run import:en -- --apply
 *     npm run import:en -- --per-category 20 --apply
 *
 * ## 为什么是搬，不是译
 *
 * 之前几批我都在从中文站翻译，那是走错了方向：这家机构**已经有一个英文站**，
 * 2020 年至今 2,700 篇，而且本月还在发稿。编辑认得那些稿子，是他们自己写的。
 * 拿中文稿重译一遍给他们看，既慢又隔。
 *
 * ## 这个脚本只搬一个「样本」，不是全量迁移
 *
 * 目的是让每一页看起来有内容：列表页、各栏目页、首页的新闻带、搜索、sitemap。
 * 所以按顶层分类各取最近 N 篇（默认 12），两三百篇就够。全量迁移是另一件事，
 * 要先决定分类怎么映射、旧链接怎么跳转、图片要不要搬进自己的存储。
 *
 * ## 分类用英文站自己的那套
 *
 * 英文站有 19 个顶层分类 + 33 个子分类（Terror in China、Religious Persecution、
 * Global Infiltration、Tuidang、Hong Kong…），和中文站的 18 个栏目不是一回事。
 * 这里按顶层那一层建，子分类先不建 —— 演示用不上两层，而两层要先改表结构。
 *
 * 之前照搬中文站播下的那 18 个英文分类会留着不动：删掉是内容组的决定，
 * 而且删了就看不出「原来播过什么」。跑完会把两套都列出来。
 *
 * ## 几处取舍，都写在这儿而不是藏在代码里
 *
 *   图片直接引用 global.tuidang.org 上的原图。演示够用；真要上线得搬进自己的
 *   存储，否则旧站一关图就全没了。
 *
 *   slug 用 WP 原来的（已经是干净的英文），不加日期前缀。中文站加前缀是因为
 *   拼音 slug 容易重；英文标题本身就够分辨，而且保持原样编辑一眼认得。
 *
 *   legacy_url 记下旧地址 /2026/10/12/<slug>/，将来要做 301 时有据可依。
 *   这个脚本本身不写重定向表 —— 那要等确定了全量迁移方案再说。
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { htmlToMarkdownLite } from "./migrate-wp-posts";

const SOURCE = "https://global.tuidang.org";
/* 旧站在 Cloudflare 挑战页后面，直连 403。这个项目一贯的绕法。 */
const PROXY = "https://r.jina.ai/";

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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

/**
 * 取一段 JSON。
 *
 * 代理把响应包在一段 Markdown 里（Title/URL Source/…），JSON 从第一个 `[` 或
 * `{` 开始、到最后一个 `]` 或 `}` 结束。只找开头不够 —— 后面还跟着代理自己的
 * 尾巴，JSON.parse 会在末尾炸。
 */
async function fetchJson<T>(path: string, expectArray = true): Promise<T> {
  const url = `${PROXY}${SOURCE}/wp-json/wp/v2/${path}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      const text = await res.text();
      const start = text.search(/[[{]"?/);
      if (start < 0) throw new Error("响应里找不到 JSON");
      const open = text[start];
      const close = open === "[" ? "]" : "}";
      const end = text.lastIndexOf(close);
      if (end <= start) throw new Error("JSON 不完整");
      const parsed = JSON.parse(text.slice(start, end + 1)) as T;
      /*
       * 代理偶尔会把一条错误消息当成正常响应返回（WP 的 {"code":"...","message":...}），
       * 或者只回半截。调用方等的是数组，拿到别的就当这一次失败、重试 ——
       * 不要让一次抖动把整批搬运停在中间。
       */
      if (expectArray && !Array.isArray(parsed)) {
        throw new Error(`等一个数组，拿到 ${JSON.stringify(parsed).slice(0, 120)}`);
      }
      return parsed;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error("取不到");
}

interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

interface WpPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  categories: number[];
  _embedded?: { "wp:featuredmedia"?: { source_url?: string; alt_text?: string; caption?: { rendered?: string } }[] };
}

/** HTML 实体与标签都去掉，留纯文字。摘要与 body_plain 用。 */
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 署名。
 *
 * 这个站的习惯是正文第一段写 `<strong>作者 | 来源</strong>`，来源常常是个链接。
 * 认不出来就留空 —— 编一个署名比没有署名糟得多。
 */
function bylineOf(html: string): string {
  const first = html.match(/<p>\s*<strong>([\s\S]{0,160}?)<\/strong>\s*<\/p>/i);
  if (!first) return "";
  const text = plain(first[1]);
  /* 一段话不是署名。超过这个长度多半是导语被加粗了。 */
  return text.length > 0 && text.length <= 80 ? text : "";
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));

  const apply = process.argv.includes("--apply");
  const perCategory = Number(arg("--per-category") ?? "12");
  const locale = "en";

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n========== 从 ${SOURCE} 取样本${apply ? "" : "（预演）"} ==========\n`);

  /* ── 分类 ───────────────────────────────────────────────────────── */
  let cats: WpCategory[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const rows = await fetchJson<WpCategory[]>(
      `categories?per_page=100&page=${page}&_fields=id,name,slug,count,parent`
    );
    cats = cats.concat(rows);
    if (rows.length < 100) break;
  }
  const top = cats.filter((c) => !c.parent && c.count > 0 && c.slug !== "uncategorized");
  /* 子分类 → 顶层，文章按它的顶层分类归档。 */
  const toTop = new Map<number, number>();
  for (const c of cats) toTop.set(c.id, c.parent || c.id);

  console.log(`  分类：${cats.length} 个（顶层 ${top.length}，子 ${cats.length - top.length}）`);

  /* ── 文章 ───────────────────────────────────────────────────────── */
  const posts = new Map<number, WpPost>();
  for (const c of top) {
    const rows = await fetchJson<WpPost[]>(
      `posts?per_page=${perCategory}&categories=${c.id}&orderby=date&order=desc&_embed=wp:featuredmedia`
    );
    for (const p of rows) posts.set(p.id, p);
    console.log(`     ${String(rows.length).padStart(3)} 篇  ${c.name}`);
  }
  console.log(`\n  去重后共 ${posts.size} 篇`);

  /* ── 落库 ───────────────────────────────────────────────────────── */
  const catRows = top.map((c) => ({
    slug: c.slug,
    name: plain(c.name),
    sort_order: 1000 - c.count,
    /*
     * 不设这个，/news/<slug> 就是 404。
     *
     * 栏目页的路由只认 is_news_listing = true 的分类（见 getNewsCategoryTabs）——
     * 这一列同时决定「顶部标签栏列哪些」和「哪些地址存在」。第一次搬完忘了设，
     * 结果 183 篇文章进去了、首页和 /news 都活了，点进任何一个栏目却是 404。
     */
    is_news_listing: true,
    locale
  }));

  const articleRows = [...posts.values()].map((p) => {
    const media = p._embedded?.["wp:featuredmedia"]?.[0];
    const body = htmlToMarkdownLite(p.content.rendered);
    return {
      slug: p.slug,
      locale,
      title: plain(p.title.rendered),
      summary: plain(p.excerpt.rendered).replace(/\s*\[?…\]?$/, "…").slice(0, 400),
      body_markdown: body,
      body_plain: plain(p.content.rendered).slice(0, 20000),
      section: "news",
      status: "published",
      editorial_status: "published",
      author: bylineOf(p.content.rendered),
      legacy_url: new URL(p.link).pathname,
      published_at: new Date(p.date).toISOString(),
      hero_image: media?.source_url ?? "",
      hero_image_alt: plain(media?.alt_text ?? ""),
      hero_credit: plain(media?.caption?.rendered ?? "").slice(0, 200)
    };
  });

  const withCover = articleRows.filter((r) => r.hero_image).length;
  const withByline = articleRows.filter((r) => r.author).length;
  console.log(`     有封面图 ${withCover} 篇，有署名 ${withByline} 篇`);
  console.log(`\n  样例：`);
  for (const r of articleRows.slice(0, 3)) {
    console.log(`     ${r.published_at.slice(0, 10)}  ${r.title.slice(0, 68)}`);
    console.log(`        ${r.slug}`);
  }

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    return;
  }

  const { error: catError } = await db
    .from("cms_article_categories")
    .upsert(catRows, { onConflict: "slug,locale" });
  if (catError) throw new Error(`分类写失败：${catError.message}`);
  console.log(`\n  ✓ 分类 ${catRows.length} 个`);

  for (let i = 0; i < articleRows.length; i += 50) {
    const { error } = await db
      .from("cms_articles")
      .upsert(articleRows.slice(i, i + 50), { onConflict: "slug,locale" });
    if (error) throw new Error(`文章写失败（第 ${i} 批）：${error.message}`);
  }
  console.log(`  ✓ 文章 ${articleRows.length} 篇`);

  /* ── 挂分类 ─────────────────────────────────────────────────────── */
  const { data: savedCats } = await db
    .from("cms_article_categories")
    .select("id, slug")
    .eq("locale", locale);
  const catId = new Map((savedCats ?? []).map((c) => [String(c.slug), String(c.id)]));

  const { data: savedArticles } = await db
    .from("cms_articles")
    .select("id, slug")
    .eq("locale", locale);
  const artId = new Map((savedArticles ?? []).map((a) => [String(a.slug), String(a.id)]));

  const slugOfWpId = new Map(top.map((c) => [c.id, c.slug]));
  const maps: { article_id: string; category_id: string; position: number }[] = [];
  for (const p of posts.values()) {
    const article = artId.get(p.slug);
    if (!article) continue;
    /* 文章可能挂在几个子分类下，归到各自的顶层去重。 */
    const tops = [...new Set(p.categories.map((id) => toTop.get(id)).filter(Boolean) as number[])];
    tops.forEach((t, index) => {
      const slug = slugOfWpId.get(t);
      const category = slug ? catId.get(slug) : undefined;
      if (category) maps.push({ article_id: article, category_id: category, position: index });
    });
  }
  for (let i = 0; i < maps.length; i += 200) {
    const { error } = await db
      .from("cms_article_category_map")
      .upsert(maps.slice(i, i + 200), { onConflict: "article_id,category_id" });
    if (error) throw new Error(`分类关联写失败：${error.message}`);
  }
  console.log(`  ✓ 分类关联 ${maps.length} 条`);
  console.log("\n✓ 搬完了。这是样本，不是全量迁移 —— 见本文件开头。\n");
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
