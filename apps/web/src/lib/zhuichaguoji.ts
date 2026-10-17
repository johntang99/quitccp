/**
 * 追查国际「重大案例报告」的同步源。
 *
 * ## 我们登的是节选，不是全文
 *
 * 源里给的是全文，有几篇超过十万字。站上登节选、全文指回追查国际，是
 * 2026-10-17 定下的方针：那是他们的调查报告，我们做的是让读者看见它，
 * 不是替它当宿主。所以每篇正文都以一条指回原文的链接收尾 —— 写在正文
 * 里而不是模板里，因为文章页不渲染 source_url（那是视频在用的字段），
 * 而且写进正文编辑就看得见、改得动。
 *
 * ## 源的形状
 *
 * /taxonomy/term/495/feed 是 Drupal 的 RSS，30 条。每条的 <description>
 * 不是摘要而是整个渲染过的节点：标题、作者、时间戳各一个 <span>，然后
 * 才是几个 `field--name-*` 的 div。正文在 `field--name-body` 里，副标题
 * 在 `field-fubiaoti`。前面那三个 span 要丢掉 —— 标题我们自己有，作者是
 * 对方站的用户名，时间戳和 pubDate 重复。
 */

export const ZCGJ_FEED = "https://www.zhuichaguoji.org/taxonomy/term/495/feed";
export const ZCGJ_CATEGORY_SLUG = "worldwide-investigation";
export const ZCGJ_SOURCE_TITLE = "追查迫害法轮功国际组织";

/**
 * 节选长度。
 *
 * 七百字上下，按段落切，所以实际长度浮动。够读者判断这篇讲什么、值不值
 * 得点过去，又不至于把对方的报告整篇搬过来。
 */
const EXCERPT_TARGET = 700;

export interface ZcgjItem {
  title: string;
  /** 原文地址，同时用作去重键。 */
  link: string;
  publishedAt: string;
  subtitle: string;
  /** 节选 + 指回原文的那一行。 */
  bodyMarkdown: string;
  bodyPlain: string;
  summary: string;
  /** 全文字数，只用来在日志里说明截掉了多少。 */
  fullLength: number;
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

/**
 * 第一个 `field--name-<name>` div 的内容。
 *
 * 数括号而不是用正则匹配整段：body 里有嵌套 div，`<div.*?</div>` 会停在
 * 第一个内层闭合标签上，正文就被砍掉一半。
 */
function field(html: string, name: string): string {
  const open = new RegExp(`<div[^>]*field--name-${name}[^>]*>`).exec(html);
  if (!open) return "";
  let depth = 1;
  let i = open.index + open[0].length;
  const start = i;
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

/** 这个源实际用到的那几个标签，转成 Markdown。 */
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

/**
 * 整段整段地取，直到够长为止。
 *
 * 按段落切而不是按字数硬截：硬截会把句子切断，读者看到的最后一行是半句
 * 话。至少留一段 —— 哪怕第一段就超了长度，截断它也不会让它更短。
 */
export function excerpt(full: string, link: string, title: string): string {
  const paragraphs = full.split(/\n{2,}/).filter((p) => p.trim());
  const taken: string[] = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    if (taken.length > 0 && length + paragraph.length > EXCERPT_TARGET) break;
    taken.push(paragraph);
    length += paragraph.length;
  }
  const trimmed = taken.length < paragraphs.length;
  const body = taken.join("\n\n");
  /* 省略号只在真的截断时出现；整篇本来就短于目标长度的，不该假装还有下文。 */
  const ellipsis = trimmed ? "\n\n⋯⋯" : "";
  return `${body}${ellipsis}\n\n---\n\n本文节选自${ZCGJ_SOURCE_TITLE}的调查报告。[阅读原文全文 →](${link})`;
}

/** 中文标题直接进地址，末尾附 node id。 */
export function zcgjSlug(title: string, link: string): string {
  const nodeId = link.split("/").pop() ?? "";
  /* 认 node id 不认标题：追查国际的标题重复过（同一专题分上下集），而且
     标题随时可能被他们改掉，node id 不会。 */
  const base = title
    .trim()
    .replace(/[\s　]+/g, "-")
    .replace(/[/\\?#&%"'<>|：:，。、！？（）()【】《》]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-zcgj${nodeId}` : `zcgj-${nodeId}`;
}

/** 抓源站并解析。网络或解析出问题都抛错，调用方决定怎么办。 */
export async function fetchZcgjItems(): Promise<ZcgjItem[]> {
  const response = await fetch(ZCGJ_FEED, {
    cache: "no-store",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`源站返回 HTTP ${response.status}`);
  const xml = await response.text();

  const items: ZcgjItem[] = [];
  for (const [, entry] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const link = tag(entry, "link");
    const title = tag(entry, "title").replace(/<[^>]+>/g, "").trim();
    const description = tag(entry, "description");
    const full = toMarkdown(field(description, "body"));
    /* 两百字以下的多半是解析没对上，而不是真有这么短的调查报告。宁可少
       导一条，也不要往站上放一段残缺的正文。 */
    if (!title || !link || full.length < 200) continue;

    const bodyMarkdown = excerpt(full, link, title);
    const bodyPlain = bodyMarkdown.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    items.push({
      title,
      link,
      publishedAt: new Date(tag(entry, "pubDate")).toISOString(),
      subtitle: toMarkdown(field(description, "field-fubiaoti")).slice(0, 200),
      bodyMarkdown,
      bodyPlain,
      summary: full.split("\n").find((line) => line.length > 20)?.slice(0, 160) ?? "",
      fullLength: full.length
    });
  }
  return items;
}
