/**
 * 把追查国际「重大案例报告」栏目的文章导进来，存为草稿。
 *
 *   npx tsx --env-file=.env.local scripts/import-zhuichaguoji.ts [--write]
 *
 * 不带 --write 只打印将要发生什么，不碰数据库。
 *
 * ## 为什么是一次性脚本而不是定时任务
 *
 * 这是反馈里「需要從追查國際以下連結直接更新文章到這邊」的第一步。先把
 * 这 30 条导成草稿让编辑看格式对不对，再决定要不要上自动同步、要不要往
 * 前补历史 —— 一上来就往站上自动灌外站内容，错了收不回来。
 *
 * ## 源里拿到的是什么
 *
 * /taxonomy/term/495/feed 是 Drupal 的 RSS，每条的 <description> 不是摘要
 * 而是整个渲染过的节点：标题、作者、时间戳各一个 <span>，然后才是几个
 * `field--name-*` 的 div。正文在 `field--name-body` 里，副标题在
 * `field-fubiaoti`，发表日期在 `field-fabiaoriqi`。前面那三个 span 要丢掉
 * —— 标题我们自己有，作者是对方站的用户名，时间戳和 pubDate 重复。
 *
 * ## 去重靠 source_url
 *
 * 每条都有 https://www.zhuichaguoji.org/node/<id> 这个稳定地址。slug 由标题
 * 生成，但标题可能改；node id 不会。所以认 source_url，不认 slug。
 */
import { createClient } from "@supabase/supabase-js";

const FEED = "https://www.zhuichaguoji.org/taxonomy/term/495/feed";
const CATEGORY_SLUG = "worldwide-investigation";
const SOURCE_TITLE = "追查迫害法轮功国际组织";
const LOCALE = "zh";
const WRITE = process.argv.includes("--write");

interface Item {
  title: string;
  link: string;
  publishedAt: string;
  subtitle: string;
  bodyMarkdown: string;
  bodyPlain: string;
  summary: string;
}

function unescapeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tag(xml: string, name: string): string {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? unescapeXml(match[1]).trim() : "";
}

/** The inner HTML of the first `field--name-<name>` div. */
function field(html: string, name: string): string {
  const open = new RegExp(`<div[^>]*field--name-${name}[^>]*>`).exec(html);
  if (!open) return "";
  let depth = 1;
  let i = open.index + open[0].length;
  const start = i;
  /* Counted rather than matched with a regex: the body div holds nested divs,
     and `<div.*?</div>` would stop at the first inner close tag. */
  while (i < html.length && depth > 0) {
    const next = /<(\/?)div\b/g;
    next.lastIndex = i;
    const m = next.exec(html);
    if (!m) break;
    depth += m[1] ? -1 : 1;
    i = m.index + m[0].length;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

/** The small subset of HTML this feed actually uses, as markdown. */
function toMarkdown(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, "").trim();
      return label ? `[${label}](${href})` : href;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function toSlug(title: string, nodeId: string): string {
  /* 和站上现有文章一致：中文标题直接进地址，空格和标点换成连字符。保不住
     唯一性时附上 node id —— 追查国际的标题重复过（同一专题分上下集）。 */
  const base = title
    .trim()
    .replace(/[\s　]+/g, "-")
    .replace(/[\/\\?#&%"'<>|：:，。、！？（）()【】《》]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-zcgj${nodeId}` : `zcgj-${nodeId}`;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 没配");
  const supabase = createClient(url, key);

  console.log(`抓取 ${FEED}`);
  const response = await fetch(FEED, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`源站返回 HTTP ${response.status}`);
  const xml = await response.text();

  const raw = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  console.log(`源里有 ${raw.length} 条\n`);

  const items: Item[] = [];
  for (const entry of raw) {
    const link = tag(entry, "link");
    const title = tag(entry, "title").replace(/<[^>]+>/g, "").trim();
    const description = tag(entry, "description");
    const bodyHtml = field(description, "body");
    const bodyMarkdown = toMarkdown(bodyHtml);
    if (!title || !link || bodyMarkdown.length < 200) {
      console.log(`  跳过（正文太短或缺字段）：${title || link}`);
      continue;
    }
    const bodyPlain = bodyMarkdown.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    items.push({
      title,
      link,
      publishedAt: new Date(tag(entry, "pubDate")).toISOString(),
      subtitle: toMarkdown(field(description, "field-fubiaoti")).slice(0, 200),
      bodyMarkdown,
      bodyPlain,
      /* 开头一段当摘要，列表页和分享卡都用它。 */
      summary: bodyPlain.split("\n").find((line) => line.length > 20)?.slice(0, 160) ?? ""
    });
  }

  const { data: categoryRow, error: categoryError } = await supabase
    .from("cms_article_categories")
    .select("id, name")
    .eq("slug", CATEGORY_SLUG)
    .maybeSingle();
  if (categoryError || !categoryRow) throw new Error(`找不到分类 ${CATEGORY_SLUG}`);

  const links = items.map((item) => item.link);
  const { data: existing } = await supabase
    .from("cms_articles")
    .select("id, source_url")
    .in("source_url", links);
  const already = new Set((existing ?? []).map((row) => String(row.source_url)));

  const fresh = items.filter((item) => !already.has(item.link));
  console.log(`解析出 ${items.length} 条，其中 ${already.size} 条已经导过，本次 ${fresh.length} 条\n`);
  for (const item of fresh) {
    console.log(`  ${item.publishedAt.slice(0, 10)}  ${item.title}`);
    console.log(`      ${item.bodyMarkdown.length} 字  ${item.subtitle ? `副标题「${item.subtitle}」` : "无副标题"}`);
  }

  if (!WRITE) {
    console.log("\n（试运行。加 --write 才真的写入。）");
    return;
  }
  if (fresh.length === 0) {
    console.log("\n没有新内容，什么都没做。");
    return;
  }

  const payload = fresh.map((item) => ({
    slug: toSlug(item.title, item.link.split("/").pop() ?? ""),
    locale: LOCALE,
    title: item.title,
    subtitle: item.subtitle,
    summary: item.summary,
    body_markdown: item.bodyMarkdown,
    body_plain: item.bodyPlain,
    section: "news",
    /* 草稿，不是发布：这是外站内容，要编辑过目之后才上站。 */
    status: "draft",
    editorial_status: "draft",
    source_title: SOURCE_TITLE,
    source_url: item.link,
    published_at: item.publishedAt
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("cms_articles")
    .upsert(payload, { onConflict: "slug,locale" })
    .select("id, slug");
  if (insertError) throw insertError;

  const { error: mapError } = await supabase
    .from("cms_article_category_map")
    .upsert(
      (inserted ?? []).map((row) => ({
        article_id: String(row.id),
        category_id: String(categoryRow.id),
        position: 0
      })),
      { onConflict: "article_id,category_id" }
    );
  if (mapError) throw mapError;

  console.log(`\n写入 ${inserted?.length ?? 0} 篇草稿，已归入「${categoryRow.name}」。`);
  console.log("后台 → 文章 → 查找与修改，按状态筛「草稿」即可逐篇过目。");
}

main().catch((error) => {
  console.error("导入失败：", error instanceof Error ? error.message : error);
  process.exit(1);
});
