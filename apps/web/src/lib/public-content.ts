import {
  pageRouteToContentPath,
  prototypePageContentSeeds,
  routeSeeds,
  type TemplateKind
} from "@quitccp/content-schema";
import { firstImageInMarkdown } from "@/lib/markdown-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import type { RenderablePage } from "./site-data";
import { extractNewsSlugFromHref, toNewsArticleSlug } from "./news-linking";

const fallbackCatalog: RenderablePage[] = routeSeeds.map((seed) => {
  const contentPath = pageRouteToContentPath(seed.section, seed.slug);
  return {
    section: seed.section,
    slug: seed.slug,
    title: seed.title,
    template: seed.template,
    summary: `${seed.title} - ${seed.template}`,
    locale: "zh",
    contentPath,
    content:
      prototypePageContentSeeds.find((row) => row.section === seed.section && row.slug === seed.slug)?.data ?? {}
  };
});

const templateKinds = new Set<TemplateKind>([
  "home",
  "section-home",
  "list-archive",
  "article",
  "form",
  "video-library",
  "long-form",
  "legal"
]);

function asTemplateKind(value: unknown): TemplateKind {
  const maybe = String(value ?? "");
  return templateKinds.has(maybe as TemplateKind) ? (maybe as TemplateKind) : "section-home";
}

function fallbackFind(section: string, slug: string) {
  return fallbackCatalog.find((page) => page.section === section && page.slug === slug);
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asObject(item))
    .filter((row) => Object.keys(row).length > 0);
}

export type ArticleBodyRow =
  | { type: "p" | "h2" | "h3" | "blockquote"; text: string }
  | { type: "figure"; src: string; alt: string }
  | { type: "video"; src: string; caption: string }
  | { type: "audio"; src: string; label: string }
  | { type: "table"; head: string[]; rows: string[][] };

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Keeps the inline markup the reader's renderer understands, and removes the
 * rest.
 *
 * `MarkdownBody.renderInline` handles exactly three things: `[text](href)`,
 * `**bold**` and `*em*`. Everything else that survives into a paragraph shows
 * up as literal punctuation -- and the imported articles are full of it:
 * backticks, underscores, stray HTML, and single asterisks used as a bullet
 * (`*双面间谍，两面通吃` opens a section in 483 of them).
 *
 * So this is not "strip" versus "don't strip". The three supported spans are
 * lifted out, the leftovers are cleaned exactly as before, and the spans go
 * back in. Readers get working links and bold without a single stray symbol.
 */
function preserveSupportedInlineMarkdown(value: string): string {
  const kept: string[] = [];
  const stash = (match: string) => {
    kept.push(match);
    // \u0000 cannot appear in the source text, so the placeholder is safe.
    return `\u0000${kept.length - 1}\u0000`;
  };

  const protectedText = value
    // An inline image is not a span the paragraph renderer can draw; image
    // lines are turned into `figure` rows earlier, so anything left here is
    // mid-sentence and was dropped before this change too.
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, "")
    .replace(/\[[^\]\n]+\]\([^)\s]+\)/g, stash)
    .replace(/\*\*[^*\n]+\*\*/g, stash)
    .replace(/\*[^*\n]+\*/g, stash);

  const cleaned = protectedText
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  /*
   * Unwrap repeatedly: a stashed span can contain another placeholder.
   * `***[下载链接](…mp3)***` stashes the link, then the bold pattern matches the
   * `**…**` around that placeholder and stashes it again. One pass restored the
   * outer span and left the inner marker in the text, where it reached the
   * reader as a NUL character.
   */
  let restored = cleaned;
  for (let pass = 0; pass < kept.length + 1; pass += 1) {
    const next = restored.replace(/\u0000(\d+)\u0000/g, (_, index) => kept[Number(index)] ?? "");
    if (next === restored) break;
    restored = next;
  }
  // Belt and braces: never let a marker reach the page, whatever the input.
  return restored.replace(/\u0000/g, "");
}

function isLikelyStandaloneSubheading(lines: string[], index: number): boolean {
  const current = lines[index]?.trim() ?? "";
  if (!current) return false;
  if (index === 0) return false;

  const prev = lines[index - 1]?.trim() ?? "";
  const next = lines[index + 1]?.trim() ?? "";
  if (prev || next) return false;

  if (current.length < 4 || current.length > 38) return false;
  if (/^(https?:\/\/|[-*]\s|\d+\.\s)/.test(current)) return false;
  if (/[。；，：]$/.test(current)) return false;

  // Standalone section lines in migrated CN articles are usually short titles
  // between two blank lines; keep this conservative to avoid false positives.
  return /[\p{Script=Han}A-Za-z0-9“”"'"'（）()《》·—\-？！?]/u.test(current);
}

/** The culture library's three categories, which are not news sections. */
export const CULTURE_CATEGORY_NAMES = new Set(["传统文化文章", "诗词", "歌曲"]);

/**
 * `keepInline` keeps `[text](href)`, `**bold**` and `*em*` inside paragraphs --
 * the three spans the reader's renderer can draw -- and strips everything else,
 * so uneven imported markdown still cannot leak stray punctuation.
 */
export function markdownToBodyRows(
  markdown: string,
  options: { keepInline?: boolean } = {}
): ArticleBodyRow[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const rows: ArticleBodyRow[] = [];
  let paragraphBuffer: string[] = [];
  let quoteBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    rows.push({ type: "p", text });
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    const text = quoteBuffer.join(" ").trim();
    quoteBuffer = [];
    if (!text) return;
    rows.push({ type: "blockquote", text });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushQuote();
      continue;
    }
    // A markdown table: a header row, a |---|---| separator, then body rows.
    // Without this the whole thing collapsed into one paragraph of pipes.
    if (/^\|.*\|$/.test(line) && /^\|[\s:|-]+\|$/.test((lines[index + 1] ?? "").trim())) {
      flushParagraph();
      flushQuote();
      const cells = (row: string) =>
        row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => stripInlineMarkdown(cell));
      const head = cells(line);
      const body: string[][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && /^\|.*\|$/.test(lines[cursor].trim())) {
        body.push(cells(lines[cursor]));
        cursor += 1;
      }
      rows.push({ type: "table", head, rows: body });
      index = cursor - 1;
      continue;
    }

    // ::: video <url> / caption / ::: -- what the HTML converter turns an
    // <iframe> into, and what the editor's 插入视频 button writes. 695 published
    // articles carried one and printed it as literal text, fences and all.
    const fence = line.match(/^:::\s*video\s+(\S+)\s*$/i);
    if (fence) {
      flushParagraph();
      flushQuote();
      const caption: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && !/^:::\s*$/.test(lines[cursor].trim())) {
        const text = lines[cursor].trim();
        if (text) caption.push(text);
        cursor += 1;
      }
      rows.push({ type: "video", src: fence[1], caption: caption.join(" ") });
      // Skip past the closing fence; if there is none, stop at the caption.
      index = cursor < lines.length ? cursor : lines.length;
      continue;
    }

    // Images used to be dropped here. The body kept the caption line that
    // follows each one, so a photo essay rendered as a column of
    // 「（作者提供）」 with nothing above them.
    const image =
      line.match(/^!\[([^\]]*)]\(([^)\s]+)[^)]*\)$/) ??
      line.match(/^<img\b[^>]*\bsrc="([^"]+)"[^>]*\balt="([^"]*)"/i);
    if (image) {
      flushParagraph();
      flushQuote();
      const isHtml = line.startsWith("<");
      const src = isHtml ? image[1] : image[2];
      const alt = isHtml ? image[2] : image[1];
      rows.push({ type: "figure", src, alt });
      // The old site repeats the caption as the next line. Consume it rather
      // than printing it twice, once as the figure's caption and once as prose.
      const next = (lines[index + 1] ?? "").trim();
      if (alt && next === alt) index += 1;
      continue;
    }
    if (/^<img\b/i.test(line)) {
      flushParagraph();
      flushQuote();
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      const cleaned = stripInlineMarkdown(line.replace(/^>\s?/, ""));
      if (cleaned) quoteBuffer.push(cleaned);
      continue;
    }
    flushQuote();

    if (/^###\s+/.test(line)) {
      flushParagraph();
      const text = stripInlineMarkdown(line.replace(/^###\s+/, ""));
      if (text) rows.push({ type: "h3", text });
      continue;
    }
    if (/^#{1,2}\s+/.test(line)) {
      flushParagraph();
      const raw = line.replace(/^#{1,2}\s+/, "");
      const text = options.keepInline
        ? preserveSupportedInlineMarkdown(raw)
        : stripInlineMarkdown(raw);
      if (text) rows.push({ type: "h2", text });
      continue;
    }
    /*
     * Guessing a subheading only makes sense for the imported articles, whose
     * markdown has no headings of its own. Content written in this CMS says
     * what it means -- and the guess actively damages it: a FAQ answer ending
     * in "更多信息请参考：[常见问题解答](/services/faq)" is a short line between
     * two blank lines, so it became an <h3> and the link inside was flattened
     * away. 17 of the 45 answers lost their closing link that way.
     */
    if (!options.keepInline && isLikelyStandaloneSubheading(lines, index)) {
      flushParagraph();
      const text = stripInlineMarkdown(line);
      if (text) rows.push({ type: "h3", text });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      const text = stripInlineMarkdown(line.replace(/^[-*]\s+/, ""));
      if (text) rows.push({ type: "p", text: `• ${text}` });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const text = stripInlineMarkdown(line.replace(/^\d+\.\s+/, ""));
      if (text) rows.push({ type: "p", text: `• ${text}` });
      continue;
    }

    // An image can also sit inside a paragraph rather than on its own line.
    // stripInlineMarkdown drops those, so pull them out and emit them as
    // figures after the paragraph they were embedded in.
    const embedded = [...line.matchAll(/!\[([^\]]*)]\(([^)\s]+)[^)]*\)/g)];
    /*
     * A linked recording becomes a player, not a line of text.
     *
     * 151 of the 160 歌曲 articles carry their music as a single markdown link
     * to an .mp3 -- usually `*[下载链接](…mp3)*`. This has to be read before
     * stripInlineMarkdown, which keeps the label and throws the address away:
     * every piece of music on the site was reaching readers as the dead words
     * "下载链接" with no way to hear or fetch anything.
     */
    const audioLinks = [...line.matchAll(/\[([^\]]*)]\((https?:\/\/[^)\s]+\.(?:mp3|m4a|wav|ogg))\)/gi)];
    let cleaned = options.keepInline
      ? preserveSupportedInlineMarkdown(line)
      : stripInlineMarkdown(line);
    for (const match of audioLinks) {
      const label = match[1].trim();
      if (label) cleaned = cleaned.split(label).join("");
    }
    cleaned = cleaned.trim();
    if (embedded.length > 0) {
      // The old site appends each photograph's caption to the same line as the
      // image, so what survives stripInlineMarkdown is the caption on its own.
      // Printed as prose it became a paragraph stating exactly what the
      // figcaption underneath the photo already said, once per photo.
      for (const match of embedded) {
        const alt = match[1].trim();
        if (alt) cleaned = cleaned.split(alt).join("");
      }
      cleaned = cleaned.trim();
    }
    if (cleaned) paragraphBuffer.push(cleaned);
    if (embedded.length > 0 || audioLinks.length > 0) {
      flushParagraph();
      for (const match of embedded) rows.push({ type: "figure", src: match[2], alt: match[1] });
      for (const match of audioLinks) {
        rows.push({ type: "audio", src: match[2], label: match[1].trim() || "下载" });
      }
    }
  }

  flushParagraph();
  flushQuote();
  return rows;
}

function toDateLabel(isoLike: string): string {
  const parsed = new Date(isoLike);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return isoLike || "日期未标注";
}

const VIRTUAL_NEWS_SOURCE_PATHS = [
  "pages/news-index.json",
  "pages/news-announcements.json",
  "pages/news-investigations.json",
  "pages/news-commentary.json",
  "pages/news-solidarity.json",
  "pages/news-stories.json",
  "pages/resources-index.json",
  "pages/resources-culture.json"
] as const;

interface VirtualArticleCandidate {
  slug: string;
  title: string;
  summary: string;
  tag: string;
  image: string;
  meta: string;
}

function virtualNewsPreferredGroups(path: string, payload: Record<string, unknown>): Record<string, unknown>[][] {
  // pages/news-index.json was redesigned into section blocks; avoid legacy `items`
  // because stale rows can carry mismatched images for the same slug.
  if (path === "pages/news-index.json") {
    const frontLead = asObject(payload.frontLead);
    return [
      Object.keys(frontLead).length > 0 ? [frontLead] : [],
      asObjectArray(payload.frontList),
      asObjectArray(payload.briefItems),
      asObjectArray(asObject(payload.solidaritySection).items),
      asObjectArray(asObject(payload.investigationsSection).items),
      asObjectArray(asObject(payload.commentarySection).items),
      asObjectArray(asObject(payload.announcementsSection).items),
      asObjectArray(asObject(payload.storiesSection).items)
    ];
  }
  if (path === "pages/resources-index.json") {
    return [asObjectArray(payload.relatedArticles)];
  }
  if (path === "pages/resources-culture.json") {
    return [asObjectArray(payload.items)];
  }
  return [asObjectArray(payload.items), asObjectArray(payload.noticeRows), asObjectArray(payload.docRows)];
}

function virtualNewsSupplementalGroups(path: string, payload: Record<string, unknown>): Record<string, unknown>[][] {
  // Keep legacy rows only as image fallback for slugs that currently have empty
  // image fields in redesigned index blocks.
  if (path === "pages/news-index.json") {
    return [asObjectArray(payload.items), asObjectArray(payload.noticeRows), asObjectArray(payload.docRows)];
  }
  return [];
}

function maybeResolveVirtualArticleRow(
  targetSlug: string,
  row: Record<string, unknown>,
  fallbackTag: string,
  fallbackMeta = ""
): VirtualArticleCandidate | null {
  const title = asString(row.title);
  if (!title) return null;
  const rowHref = asString(row.href);
  const resolvedSlug = asString(row.slug) || extractNewsSlugFromHref(rowHref) || toNewsArticleSlug(title);
  if (resolvedSlug !== targetSlug) return null;
  const summary = asString(row.summary, asString(row.body));
  const facts = Array.isArray(row.facts) ? row.facts.map((item) => asString(item)).filter(Boolean).join(" · ") : "";
  return {
    slug: resolvedSlug,
    title,
    summary,
    tag: asString(row.tag, asString(row.badge, fallbackTag)),
    image: asString(row.image),
    meta: asString(row.meta, asString(row.date, facts || fallbackMeta))
  };
}

async function findVirtualNewsArticle(slug: string): Promise<VirtualArticleCandidate | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_content_entries")
    .select("path, data")
    .eq("locale", "zh")
    .in("path", [...VIRTUAL_NEWS_SOURCE_PATHS]);
  if (error) throw error;

  let preferred: VirtualArticleCandidate | null = null;
  let supplemental: VirtualArticleCandidate | null = null;
  for (const row of data ?? []) {
    const path = asString((row as Record<string, unknown>).path);
    const payload = asObject((row as Record<string, unknown>).data);
    const sourceTag = path.includes("announcements")
      ? "机构公告与声明"
      : path.includes("investigations")
        ? "追查国际调查报告"
        : path.includes("commentary")
          ? "专题报导与时政评论"
          : path.includes("solidarity")
            ? "国际声援行动"
            : path.includes("stories")
              ? "三退新闻与故事"
              : "新闻与报告";

    const preferredSources = virtualNewsPreferredGroups(path, payload);
    for (const group of preferredSources) {
      for (const item of group) {
        const candidate = maybeResolveVirtualArticleRow(slug, item, sourceTag);
        if (!candidate) continue;
        if (!preferred || (!preferred.image && candidate.image)) preferred = candidate;
      }
    }
    const supplementalSources = virtualNewsSupplementalGroups(path, payload);
    for (const group of supplementalSources) {
      for (const item of group) {
        const candidate = maybeResolveVirtualArticleRow(slug, item, sourceTag);
        if (!candidate) continue;
        if (!supplemental || (!supplemental.image && candidate.image)) supplemental = candidate;
      }
    }
  }
  if (preferred) {
    if (!preferred.image && supplemental?.image) {
      return { ...preferred, image: supplemental.image };
    }
    return preferred;
  }
  return supplemental;
}

function isTableMissingError(error: unknown): boolean {
  const message = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
  return message.includes("cms_content_entries") && (message.includes("does not exist") || message.includes("42P01"));
}

export async function getRenderablePage(section: string, slug = "index"): Promise<RenderablePage | null> {
  const fallback = fallbackFind(section, slug);
  const locale = "zh";
  const contentPath = pageRouteToContentPath(section, slug);
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: pageRow, error: pageError }, { data: contentRow, error: contentError }] = await Promise.all([
      supabase
        .from("cms_pages")
        .select("section, slug, title, template_kind, status, locale, blocks")
        .eq("section", section)
        .eq("slug", slug)
        .eq("locale", locale)
        .in("status", ["published", "review", "draft"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cms_content_entries")
        .select("data")
        .eq("locale", locale)
        .eq("path", contentPath)
        .maybeSingle()
    ]);
    if (pageError) throw pageError;
    if (contentError && !isTableMissingError(contentError)) throw contentError;

    const meta: RenderablePage | null = pageRow
      ? {
          section: String(pageRow.section),
          slug: String(pageRow.slug),
          title: String(pageRow.title),
          template: asTemplateKind(pageRow.template_kind),
          summary: `${pageRow.title} - ${pageRow.template_kind ?? "section-home"}`,
          locale: String(pageRow.locale ?? locale),
          contentPath
        }
      : fallback ?? null;
    if (!meta) return null;

    const contentCandidate = asObject(contentRow?.data);
    const blocksFallback =
      pageRow && Array.isArray(pageRow.blocks)
        ? {
            title: String(pageRow.title ?? meta.title),
            blocks: pageRow.blocks
          }
        : {};
    const metaContent = asObject(meta.content ?? {});
    const fallbackContent = asObject(fallback?.content ?? {});
    const resolvedFallback =
      Object.keys(metaContent).length > 0
        ? metaContent
        : Object.keys(fallbackContent).length > 0
          ? fallbackContent
          : asObject(blocksFallback);
    const content =
      Object.keys(contentCandidate).length > 0
        ? contentCandidate
        : resolvedFallback;

    return {
      ...meta,
      contentPath,
      content
    };
  } catch {
    if (!fallback) return null;
    return {
      ...fallback,
      contentPath,
      content: fallback.content ?? {}
    };
  }
}

export async function getRenderableArticle(slug: string): Promise<RenderablePage | null> {
  const normalizedSlug = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  const fallback = {
    section: "news",
    slug: normalizedSlug,
    title: `文章：${normalizedSlug}`,
    template: "article" as TemplateKind,
    summary: "article",
    locale: "zh",
    contentPath: "pages/news-article.json",
    content:
      prototypePageContentSeeds.find((row) => row.section === "news" && row.slug === "article")?.data ?? {}
  };

  try {
    const supabase = createSupabaseAdminClient();
    const listMapped = await findVirtualNewsArticle(normalizedSlug);
    const { data, error } = await supabase
      .from("cms_articles")
      .select(
        "id, slug, title, summary, body_markdown, body_plain, status, updated_at, published_at, " +
          "author, hero_image, hero_image_alt, hero_credit"
      )
      .eq("slug", normalizedSlug)
      .eq("locale", "zh")
      // Drafts are readable only by someone signed into the admin, which is
      // what the 预览 button needs. Without this check an unpublished article
      // was live at its public URL, and the slug is the Chinese title -- not a
      // secret.
      .in("status", (await isAdminViewer()) ? ["published", "review", "draft"] : ["published"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    // The select is built by concatenation, which defeats the client's column
    // inference; the shape is read through `row` and checked by hand below.
    const row = (data ?? {}) as unknown as Record<string, unknown>;
    const fallbackContent = asObject(fallback.content);
    if (!data) {
      const virtual = listMapped;
      // /news/article used to serve the prototype's sample article -- an invented
      // ceremony, publicly reachable, on a site whose whole claim is documentary
      // accuracy. The seed content is still the page *skeleton* for virtual
      // articles; it is simply no longer served as an article in its own right.
      if (!virtual) return null;
      return {
        section: "news",
        slug: virtual.slug,
        title: virtual.title,
        template: "article",
        summary: virtual.summary || "article",
        locale: "zh",
        contentPath: "pages/news-article.json",
        content: {
          ...fallbackContent,
          title: virtual.title,
          tag: virtual.tag || asString(fallbackContent.tag, "新闻与报告"),
          dek: virtual.summary || asString(fallbackContent.dek),
          byline: [virtual.meta || "日期未标注", "新闻与报告", "本站整理", "条目详情"],
          heroFigure: virtual.image
            ? {
                ...asObject(fallbackContent.heroFigure),
                image: virtual.image,
                alt: virtual.title,
                captionLines: [virtual.meta || "新闻条目", "来自页面内容条目"]
              }
            : {},
          body: [
            {
              type: "p",
              text: virtual.summary || "该条目暂无摘要。"
            },
            {
              type: "p",
              text: "该文章详情由新闻列表条目自动生成；如需完整正文，请在后台文章管理中补充原文内容。"
            }
          ]
        }
      };
    }

    const markdownBody = asString(row.body_markdown);
    const plainBody = asString(row.body_plain);
    // Links and bold now reach the reader. Until 2026-10-06 every paragraph was
    // flattened, so the 1,382 articles that carry a link showed its label as
    // dead words and the 5,185 that carry bold showed none -- and anything an
    // editor wrote in the admin's markdown editor behaved the same way.
    const markdownRows = markdownToBodyRows(markdownBody, { keepInline: true });
    const bodyRows =
      markdownRows.length > 0
        ? markdownRows
        : plainBody
          ? [{ type: "p" as const, text: plainBody }]
          : asObjectArray(fallbackContent.body).map((row) => ({
              type: "p" as const,
              text: asString((row as Record<string, unknown>).text)
            }));
    const firstParagraph = bodyRows.find((row) => row.type === "p");
    /** Every paragraph, for comparing a standfirst against what the body says. */
    const bodyText = bodyRows
      .filter((r): r is { type: "p" | "h2" | "h3" | "blockquote"; text: string } => "text" in r)
      .map((r) => r.text)
      .join(" ");
    const summary = asString(
      row.summary as string,
      firstParagraph && "text" in firstParagraph ? firstParagraph.text : ""
    );
    // The article's own cover comes first. This used to look only at a page-list
    // entry and then at the first image inside the body, so an article whose
    // cover sits in hero_image -- 5,379 of them -- showed no picture at all
    // unless its text happened to contain one.
    const heroImage =
      asString(row.hero_image) ||
      asString(listMapped?.image) ||
      firstImageInMarkdown(markdownBody);
    const heroAlt = asString(row.hero_image_alt);
    const heroCredit = asString(row.hero_credit);
    // The article's own primary category, which nothing here used to consult.
    // Without it every article fell through to the template's default and the
    // whole site claimed to be 国际声援行动.
    const category = await primaryCategory(String(row.id));
    const articleTag =
      category.name || asString(listMapped?.tag, asString(fallbackContent.tag, "新闻与报告"));
    // Date the article by when it was published, not when we last wrote the row.
    // The import touched all 15,514 rows at once, so updated_at would have put
    // today's date on a piece from 2011.
    const articleDate = asString(row.published_at) || asString(row.updated_at);
    // 诗词 is laid out as verse; everything else keeps its prose paragraphs.
    const isVerse = articleTag === "诗词";
    const displayRows = isVerse
      ? bodyRows.map((r) => ("text" in r && r.type === "p" ? { ...r, text: toVerseLines(r.text) } : r))
      : bodyRows;
    const resolvedByline = [
      toDateLabel(articleDate),
      asString(row.author) || "本站资料库",
      `约 ${plainBody.length.toLocaleString("zh-CN")} 字`
    ];
    return {
      section: "news",
      slug: String(row.slug),
      title: String(row.title),
      template: "article",
      summary: summary || "article",
      locale: "zh",
      contentPath: "pages/news-article.json",
      content: {
        ...fallbackContent,
        title: String(row.title),
        // The importer set summary to the first 240 characters of the body, so
        // showing it as the standfirst reprints the opening paragraph directly
        // above itself. Only show a standfirst that says something the body
        // does not already open with.
        // Against the whole body, not just its first paragraph: a 诗词's summary
        // is the entire poem collapsed onto one line, and the first paragraph is
        // only 「作者：…」 -- too short to trip the check, so the poem printed
        // twice, once as a standfirst and once as the body.
        dek: isEchoOfBody(summary, bodyText)
          ? ""
          : summary || asString(fallbackContent.dek),
        byline: resolvedByline,
        body: displayRows,
        verse: isVerse,
        tag: articleTag,
        // The seed's breadcrumb names a category too, and the template prefers
        // it over the tag -- so it has to be corrected here as well or the trail
        // keeps claiming a section the article is not in.
        // The seed payload carries the mockup's link-styling demo sentence, and
        // spreading the seed brought it into every real article. A migrated
        // article's body is complete as written; nothing should be appended.
        bodyLink: {},
        relatedSection: {
          ...asObject(fallbackContent.relatedSection),
          items: await getRelatedArticles(articleTag, normalizedSlug)
        },
        // 中华传统文化 articles are not news: the trail used to claim
        // 首页 / 新闻与报告 / 诗词 for every poem in the culture library.
        breadcrumb: {
          ...asObject(fallbackContent.breadcrumb),
          ...(CULTURE_CATEGORY_NAMES.has(articleTag)
            ? { sectionLabel: "中华传统文化", sectionHref: "/resources/culture" }
            : { sectionLabel: "新闻与报告", sectionHref: "/news" }),
          current: articleTag,
          /*
           * The last crumb was dead text. It names the one listing a reader is
           * most likely to want next -- everything else in this category.
           *
           * Only the eight categories in NEWS_CATEGORIES have a listing page;
           * 资料下载, 待归类 and the culture categories exist in the database but
           * `/news/<slug>` 404s for them, so those stay plain text rather than
           * becoming a link to nothing.
           */
          currentHref: NEWS_CATEGORIES.some((row) => row.slug === category.slug)
            ? `/news/${category.slug}`
            : ""
        },
        heroFigure: heroImage
          ? {
              ...asObject(fallbackContent.heroFigure),
              image: heroImage,
              alt: heroAlt || String(row.title),
              // The editor's caption and credit, when the article carries them;
              // the list entry's meta line only as a fallback.
              captionLines: [heroAlt, heroCredit].filter(Boolean).length
                ? [heroAlt, heroCredit].filter(Boolean)
                : listMapped?.meta
                  ? [String(listMapped.meta)]
                  : []
            }
          : {},
        inlineFigure: {}
      }
    };
  } catch {
    // /news/article used to serve the prototype's sample article -- an invented
    // ceremony, publicly reachable, on a site whose whole claim is documentary
    // accuracy. The seed content is still the page *skeleton* for virtual
    // articles; it is simply no longer served as an article in its own right.
    return null;
  }
}

export interface PublicVideoRecord {
  slug: string;
  title: string;
  episode: string;
  description: string;
  bodyMarkdown: string;
  sourceUrl: string;
  backupUrl: string;
  coverImage: string;
  coverImageAlt: string;
  speaker: string;
  sourceCredit: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  category: string;
  /** Slug of the same category, for the breadcrumb and the 继续观看 band. */
  categorySlug: string;
  /** Other films in the same category, newest first, this one excluded. */
  siblings: PublicVideoCard[];
}

/**
 * One video for the public page, by slug.
 *
 * Returns null rather than throwing when the video columns are missing, so the
 * route falls through to a 404 instead of a 500 on an environment where the
 * video migrations have not been applied.
 */
export async function getRenderableVideo(slug: string): Promise<PublicVideoRecord | null> {
  const normalized = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_videos")
      .select(
        "id, slug, title, episode, description, body_markdown, source_url, backup_url, cover_image, " +
          "cover_image_alt, speaker, source_credit, published_at, duration_seconds, status"
      )
      .eq("slug", normalized)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) return null;
    // The select is built by concatenation, which defeats the client's column
    // inference; the shape is checked by hand below instead.
    const row = data as unknown as Record<string, unknown>;

    const { data: mapRows } = await supabase
      .from("cms_video_category_map")
      .select("position, cms_video_categories(name, slug)")
      .eq("video_id", row.id as string)
      .order("position", { ascending: true });
    const categoryRow =
      (mapRows ?? [])
        .map((entry) => (entry as { cms_video_categories?: { name?: string; slug?: string } }).cms_video_categories)
        .find((entry) => entry?.name) ?? null;
    const category = categoryRow?.name ? String(categoryRow.name) : "";
    const categorySlug = categoryRow?.slug ? String(categoryRow.slug) : "";

    // What to watch next. A video whose text runs to 73 characters needs this
    // more than one that runs to 20,000, and it is the same query either way.
    const siblings = categorySlug ? await videoSiblings(categorySlug, String(row.slug)) : [];

    return {
      slug: String(row.slug),
      title: String(row.title),
      episode: String(row.episode ?? ""),
      description: String(row.description ?? ""),
      bodyMarkdown: String(row.body_markdown ?? ""),
      sourceUrl: String(row.source_url ?? ""),
      backupUrl: String(row.backup_url ?? ""),
      coverImage: String(row.cover_image ?? ""),
      coverImageAlt: String(row.cover_image_alt ?? ""),
      speaker: String(row.speaker ?? ""),
      sourceCredit: String(row.source_credit ?? ""),
      publishedAt: row.published_at ? String(row.published_at) : null,
      durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      category,
      categorySlug,
      siblings
    };
  } catch {
    return null;
  }
}

/**
 * Up to seven other films in a category, newest first.
 *
 * Seven is what the page spends them on: three in the rail beside the text and
 * four in the band that closes the page.
 */
async function videoSiblings(categorySlug: string, excludeSlug: string): Promise<PublicVideoCard[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: cat } = await supabase
      .from("cms_video_categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (!cat) return [];
    const { data: ids } = await supabase
      .from("cms_video_category_map")
      .select("video_id")
      .eq("category_id", String(cat.id))
      .limit(60);
    const videoIds = (ids ?? []).map((row) => String((row as { video_id: unknown }).video_id));
    if (videoIds.length === 0) return [];
    const { data: rows } = await supabase
      .from("cms_videos")
      .select("slug, title, episode, description, cover_image, duration_seconds, published_at, source_url")
      .in("id", videoIds)
      .eq("status", "published")
      .neq("slug", excludeSlug)
      .order("published_at", { ascending: false })
      .limit(7);
    return (rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        slug: String(r.slug),
        title: String(r.title),
        episode: String(r.episode ?? ""),
        description: String(r.description ?? ""),
        coverImage: String(r.cover_image ?? ""),
        durationSeconds: r.duration_seconds ? Number(r.duration_seconds) : null,
        publishedAt: r.published_at ? String(r.published_at) : null,
        sourceUrl: String(r.source_url ?? "")
      };
    });
  } catch {
    return [];
  }
}


/**
 * The name of an article's primary category -- the row at position 0 in the
 * category map, which is what the admin shows and what migration 011 exists to
 * make deterministic.
 */
async function primaryCategory(articleId: string): Promise<{ name: string; slug: string }> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_article_category_map")
      .select("position, cms_article_categories(name, slug)")
      .eq("article_id", articleId)
      .order("position", { ascending: true })
      .limit(1);
    const row = (data ?? [])
      .map((entry) => (entry as { cms_article_categories?: { name?: string; slug?: string } }).cms_article_categories)
      .find((entry) => entry?.name);
    return { name: row?.name ? String(row.name) : "", slug: row?.slug ? String(row.slug) : "" };
  } catch {
    return { name: "", slug: "" };
  }
}

export interface PublicVideoCard {
  slug: string;
  title: string;
  episode: string;
  description: string;
  coverImage: string;
  durationSeconds: number | null;
  publishedAt: string | null;
  sourceUrl: string;
}

export interface PublicVideoCategory {
  slug: string;
  name: string;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: VideoSort;
  videos: PublicVideoCard[];
}

/**
 * The orders a reader can ask for.
 *
 * The design offers a third, 最热. Nothing in the library measures how often a
 * film is watched, so there is no honest ordering behind that label and the
 * control is not rendered -- a "most popular" list assembled from publication
 * dates would be a claim the data cannot support.
 */
export type VideoSort = "latest" | "oldest";

/**
 * Listings that are not one of the eight series.
 *
 * 全部视频 is the whole library; the section index links to it from the chip row
 * and from 最新上线. Before this the 全部 → link pointed at 其它系列, which is a
 * real category of 324 films and not "everything".
 */
const VIDEO_VIRTUAL_LISTINGS: Record<string, { name: string; filter?: "featured" }> = {
  archive: { name: "全部视频" },
  featured: { name: "重要影片", filter: "featured" }
};

/**
 * One video category's listing.
 *
 * The section index links to eight of these and every one of them was a 404:
 * the videos existed but nothing led to them. Ordered by publication date with
 * `id` beneath it, for the same reason the admin lists are -- the whole library
 * shares an import timestamp.
 */
export async function getVideoCategory(
  slug: string,
  page = 1,
  sort: VideoSort = "latest",
  // 16 fills the design exactly: one lead film, three in 接着看, twelve in the grid.
  pageSize = 16
): Promise<PublicVideoCategory | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const virtual = VIDEO_VIRTUAL_LISTINGS[slug];

    let categoryId = "";
    let name = virtual?.name ?? "";
    if (!virtual) {
      const { data: category } = await supabase
        .from("cms_video_categories")
        .select("id, slug, name")
        .eq("slug", slug)
        .maybeSingle();
      if (!category) return null;
      categoryId = String(category.id);
      name = String(category.name);
    }

    const offset = (Math.max(page, 1) - 1) * pageSize;
    const columns =
      "id, slug, title, episode, description, cover_image, duration_seconds, published_at, source_url";
    let query = virtual
      ? supabase.from("cms_videos").select(columns, { count: "exact" })
      : supabase
          .from("cms_videos")
          .select(`${columns}, cms_video_category_map!inner(category_id)`, { count: "exact" })
          .eq("cms_video_category_map.category_id", categoryId);
    query = query.eq("status", "published");
    if (virtual?.filter === "featured") query = query.eq("featured", true);

    const { data, count, error } = await query
      .order("published_at", { ascending: sort === "oldest", nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) return null;

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const total = count ?? 0;
    return {
      slug,
      name,
      total,
      page: Math.max(page, 1),
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
      sort,
      videos: rows.map((row) => ({
        slug: String(row.slug),
        title: String(row.title),
        episode: String(row.episode ?? ""),
        description: String(row.description ?? ""),
        coverImage: String(row.cover_image ?? ""),
        durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
        publishedAt: row.published_at ? String(row.published_at) : null,
        sourceUrl: String(row.source_url ?? "")
      }))
    };
  } catch {
    return null;
  }
}

/** Every category with its published count, for the section index. */
export async function listPublicVideoCategories(): Promise<
  { slug: string; name: string; total: number }[]
> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_video_categories")
      .select("id, slug, name, sort_order")
      .order("sort_order", { ascending: true });
    const rows = data ?? [];
    const counts = await Promise.all(
      rows.map(async (row) => {
        const { count } = await supabase
          .from("cms_video_category_map")
          .select("video_id", { count: "exact", head: true })
          .eq("category_id", row.id);
        return count ?? 0;
      })
    );
    return rows.map((row, index) => ({
      slug: String(row.slug),
      name: String(row.name),
      total: counts[index]
    }));
  } catch {
    return [];
  }
}

/**
 * Real articles from the same category, for the "相关阅读" strip.
 *
 * The template used to carry two invented ones as its fallback. Rather than
 * leave the strip empty now that they are gone, it gets actual neighbours --
 * ordered by publication date, with `id` beneath it so the choice is stable
 * between requests rather than reshuffling on every render.
 */
export async function getRelatedArticles(
  categoryName: string,
  excludeSlug: string,
  limit = 2
): Promise<{ href: string; image: string; tag: string; title: string; meta: string }[]> {
  if (!categoryName) return [];
  try {
    const supabase = createSupabaseAdminClient();
    const { data: category } = await supabase
      .from("cms_article_categories")
      .select("id")
      .eq("name", categoryName)
      .maybeSingle();
    if (!category) return [];

    const { data } = await supabase
      .from("cms_articles")
      .select("slug, title, hero_image, published_at, cms_article_category_map!inner(category_id)")
      .eq("cms_article_category_map.category_id", category.id)
      .eq("status", "published")
      .neq("slug", excludeSlug)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(limit + 1);

    return ((data ?? []) as unknown as Record<string, unknown>[])
      .filter((row) => String(row.slug) !== excludeSlug)
      .slice(0, limit)
      .map((row) => ({
        href: `/news/${encodeURIComponent(String(row.slug))}`,
        image: String(row.hero_image ?? ""),
        tag: categoryName,
        title: String(row.title),
        meta: row.published_at ? String(row.published_at).slice(0, 10) : ""
      }));
  } catch {
    return [];
  }
}

export interface VideoLibraryShelf {
  slug: string;
  name: string;
  total: number;
  videos: PublicVideoCard[];
}

/**
 * The video library's front page: every category with its newest few.
 *
 * The section index used to be a CMS page listing five hand-written shelves and
 * sample titles, which named categories that no longer exist, omitted three that
 * do, and showed no actual video from the library.
 */
export async function getVideoLibrary(perShelf = 6): Promise<VideoLibraryShelf[]> {
  const categories = await listPublicVideoCategories();
  const shelves = await Promise.all(
    categories.map(async (category) => {
      const page = await getVideoCategory(category.slug, 1, "latest", perShelf);
      return {
        slug: category.slug,
        name: category.name,
        total: category.total,
        videos: page?.videos ?? []
      };
    })
  );
  return shelves.filter((shelf) => shelf.videos.length > 0);
}


/**
 * True when a summary is just the beginning of the body.
 *
 * Compares with punctuation and whitespace removed, because the summary was cut
 * at a fixed character count and usually ends mid-sentence. Everything that is
 * not a letter, a digit or a Han character goes: the two copies of a URL can
 * differ by an underscore or a hyphen alone, which was enough to miss the match.
 */
/**
 * Lays a 诗词 out as verse: one clause per line, as the old site printed it.
 *
 * Classical Chinese verse is stored as running text -- 「新楼栉比映东月，古巷灯明
 * 三退切。」 -- because that is how it arrives from the source. Rendered as prose
 * it becomes a single wrapped line and stops reading as a poem at all. The
 * clause boundaries are the line breaks, so the punctuation that marks them is
 * what the line break replaces.
 *
 * Attribution lines (作者：…) are prose and are left whole.
 */
export function toVerseLines(text: string): string {
  if (/^(作者|译者|编辑|文|注)[：:]/.test(text.trim())) return text;
  const lines = text
    .split(/(?<=[，。；！？])/)
    .map((line) => line.replace(/[，。；！？]\s*$/, "").trim())
    .filter(Boolean);
  // Nothing to split on means it was not punctuated verse; leave it be.
  return lines.length > 1 ? lines.join("\n") : text;
}

export function isEchoOfBody(summary: string, firstParagraph: string): boolean {
  const normalise = (value: string) => value.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, "");
  const a = normalise(summary);
  const b = normalise(firstParagraph);
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 12 && longer.startsWith(shorter.slice(0, Math.min(shorter.length, 60)));
}


/**
 * Whether the request carries a valid admin session.
 *
 * Kept deliberately cheap and failure-tolerant: a public page must render when
 * there is no cookie, and must not blow up if the session cannot be checked.
 */
async function isAdminViewer(): Promise<boolean> {
  try {
    const { getAdminSessionUser } = await import("@/lib/admin/auth");
    return (await getAdminSessionUser()) !== null;
  } catch {
    return false;
  }
}

/**
 * The news section's categories, in the order they appear everywhere: the tab
 * row, the category grid, the menus.
 *
 * Kept here rather than read from `sort_order` so the order is the same on
 * every surface and does not shift when someone re-sorts the admin list. The
 * English labels are the design's small caps line, not translations.
 */
export const NEWS_CATEGORIES = [
  { slug: "announcement-claims", name: "公告与声明", en: "ANNOUNCEMENTS" },
  { slug: "red-regime-collapse", name: "红朝败相", en: "REGIME WATCH" },
  { slug: "withdrawal-news", name: "三退要闻", en: "WITHDRAWAL NEWS" },
  { slug: "worldwide-supports", name: "国际声援行动", en: "SOLIDARITY" },
  { slug: "worldwide-investigation", name: "追查国际调查报告", en: "INVESTIGATIONS" },
  { slug: "topics-commentary", name: "专题报导与时政评论", en: "COMMENTARY" },
  { slug: "withdrawal-stories", name: "退党纪实故事", en: "STORIES" },
  { slug: "famous-quitccp", name: "名人退党", en: "NOTABLE" }
] as const;

export interface NewsCard {
  slug: string;
  title: string;
  summary: string;
  image: string;
  category: string;
  publishedAt: string | null;
  /** For 评论员专栏, which bylines its cards. */
  author: string;
  /** 第三十二集 → "32"; the investigations band numbers its episodes. */
  episode: string;
}

export interface NewsCategoryBlock {
  slug: string;
  name: string;
  en: string;
  lead: NewsCard | null;
  rest: NewsCard[];
  total: number;
}

export interface NewsHome {
  featured: NewsCard[];
  latest: NewsCard[];
  archive: NewsCard[];
  categories: NewsCategoryBlock[];
}

const NEWS_CARD_COLUMNS = "slug, title, summary, hero_image, published_at, author";

/** Chinese numerals in a 第…集 title, for the investigations band. */
const CN_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9
};

function episodeFromTitle(title: string): string {
  const match = title.match(/第\s*([0-9]+|[零一二三四五六七八九十百]+)\s*[集期]/);
  if (!match) return "";
  const raw = match[1];
  if (/^[0-9]+$/.test(raw)) return raw;

  // 三十二 → 32, 十 → 10, 八 → 8. Only needs to reach the low hundreds.
  let total = 0;
  let section = 0;
  for (const char of raw) {
    if (char === "百") {
      section = (section || 1) * 100;
      total += section;
      section = 0;
    } else if (char === "十") {
      section = (section || 1) * 10;
      total += section;
      section = 0;
    } else if (char in CN_DIGITS) {
      section = CN_DIGITS[char];
    }
  }
  return String(total + section);
}

function toNewsCard(row: Record<string, unknown>, category: string): NewsCard {
  return {
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    image: String(row.hero_image ?? ""),
    category,
    publishedAt: row.published_at ? String(row.published_at) : null,
    author: String(row.author ?? ""),
    episode: episodeFromTitle(String(row.title))
  };
}

/** Article ids for a category, via the map table's inner join. */
async function newsByCategory(
  categoryId: string,
  limit: number
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  const { data, count } = await supabase
    .from("cms_articles")
    .select(`${NEWS_CARD_COLUMNS}, id, cms_article_category_map!inner(category_id)`, { count: "exact" })
    .eq("cms_article_category_map.category_id", categoryId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(limit);
  return { rows: (data ?? []) as unknown as Record<string, unknown>[], total: count ?? 0 };
}

/**
 * Everything the news landing page shows.
 *
 * 精选 is simply the three newest flagged 重要: the newest takes the large slot
 * and the previous two slide into the column beside it, which is the rotation
 * the design describes -- no extra bookkeeping, just an ordered query.
 */
export async function getNewsHome(): Promise<NewsHome> {
  try {
    const supabase = createSupabaseAdminClient();

    const nameBySlug = new Map(NEWS_CATEGORIES.map((row) => [row.slug, row.name]));
    const { data: categoryRows } = await supabase
      .from("cms_article_categories")
      .select("id, slug, name")
      .in("slug", NEWS_CATEGORIES.map((row) => row.slug));
    const categoryById = new Map(
      (categoryRows ?? []).map((row) => [String(row.id), String(row.name)])
    );
    const idBySlug = new Map((categoryRows ?? []).map((row) => [String(row.slug), String(row.id)]));

    /** The primary category name for a set of articles, for the card's kicker. */
    const categoriesFor = async (slugs: string[]) => {
      if (slugs.length === 0) return new Map<string, string>();
      const { data: articles } = await supabase
        .from("cms_articles")
        .select("id, slug")
        .in("slug", slugs);
      const idBy = new Map((articles ?? []).map((row) => [String(row.id), String(row.slug)]));
      const { data: maps } = await supabase
        .from("cms_article_category_map")
        .select("article_id, category_id, position")
        .in("article_id", [...idBy.keys()])
        .order("position", { ascending: true });
      const out = new Map<string, string>();
      for (const row of maps ?? []) {
        const articleSlug = idBy.get(String((row as { article_id: string }).article_id));
        if (!articleSlug || out.has(articleSlug)) continue;
        const name = categoryById.get(String((row as { category_id: string }).category_id));
        if (name) out.set(articleSlug, name);
      }
      return out;
    };

    const [featuredResult, latestResult, archiveResult] = await Promise.all([
      supabase
        .from("cms_articles")
        .select(NEWS_CARD_COLUMNS)
        .eq("status", "published")
        .eq("featured", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .limit(3),
      supabase
        .from("cms_articles")
        .select(NEWS_CARD_COLUMNS)
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .limit(10),
      supabase
        .from("cms_articles")
        .select(NEWS_CARD_COLUMNS)
        .eq("status", "published")
        .eq("editor_archive", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .limit(6)
    ]);

    const featuredRows = (featuredResult.data ?? []) as unknown as Record<string, unknown>[];
    const latestRows = (latestResult.data ?? []) as unknown as Record<string, unknown>[];
    const archiveRows = (archiveResult.data ?? []) as unknown as Record<string, unknown>[];

    const kickers = await categoriesFor(
      [...featuredRows, ...latestRows, ...archiveRows].map((row) => String(row.slug))
    );

    const categories = await Promise.all(
      NEWS_CATEGORIES.map(async (category) => {
        const id = idBySlug.get(category.slug);
        if (!id) {
          return { ...category, lead: null, rest: [], total: 0 } satisfies NewsCategoryBlock;
        }
        const { rows, total } = await newsByCategory(id, 5);
        const cards = rows.map((row) => toNewsCard(row, category.name));
        return {
          slug: category.slug,
          name: category.name,
          en: category.en,
          lead: cards[0] ?? null,
          rest: cards.slice(1),
          total
        } satisfies NewsCategoryBlock;
      })
    );

    return {
      featured: featuredRows.map((row) => toNewsCard(row, kickers.get(String(row.slug)) ?? "")),
      latest: latestRows.map((row) => toNewsCard(row, kickers.get(String(row.slug)) ?? "")),
      archive: archiveRows.map((row) => toNewsCard(row, kickers.get(String(row.slug)) ?? "")),
      categories
    };
  } catch {
    return { featured: [], latest: [], archive: [], categories: [] };
  }
}

/**
 * Primary category name per article slug, in one round trip.
 *
 * Lifted out of getNewsHome so the section-wide listings label their cards the
 * same way the homepage does rather than growing a second copy of the rule.
 */
async function primaryCategoryNames(slugs: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();
  try {
    const supabase = createSupabaseAdminClient();
    const { data: articles } = await supabase.from("cms_articles").select("id, slug").in("slug", unique);
    const slugById = new Map((articles ?? []).map((row) => [String(row.id), String(row.slug)]));
    if (slugById.size === 0) return new Map();
    const { data: maps } = await supabase
      .from("cms_article_category_map")
      .select("article_id, position, cms_article_categories(name)")
      .in("article_id", [...slugById.keys()])
      .order("position", { ascending: true });
    const out = new Map<string, string>();
    for (const row of maps ?? []) {
      const articleSlug = slugById.get(String((row as { article_id: string }).article_id));
      // position ascending, so the first row seen for an article is its primary.
      if (!articleSlug || out.has(articleSlug)) continue;
      const name = (row as { cms_article_categories?: { name?: string } }).cms_article_categories?.name;
      if (name) out.set(articleSlug, String(name));
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * The homepage's news block, read live from the article table.
 *
 * It used to be typed by hand into the homepage admin, and had gone stale in
 * two ways at once: the lead and the three 最新发布 rows linked to articles on
 * the old tuidang.org rather than to our own pages, and all four 专题栏目
 * "全部…" links pointed at menu slugs that no longer exist and returned 404.
 * Anything an editor still controls -- headings, labels, which four columns
 * appear -- stays in the CMS; only the articles come from here.
 */
export interface HomeNewsLive {
  /** Newest article flagged 重要, or the newest published if none is. */
  lead: NewsCard | null;
  leadIsFlagged: boolean;
  /** The three newest after the lead, never repeating it. */
  items: NewsCard[];
  /** Latest article per requested column, keyed by the category name asked for. */
  channelLeads: Map<string, { card: NewsCard | null; slug: string }>;
}

/** Names the homepage cards use that differ from the category's own name. */
const CHANNEL_NAME_ALIASES: Record<string, string> = {
  三退新闻: "三退要闻",
  追查国际调查报告: "追查国际调查报告",
  专题报导与时政评论: "专题报导与时政评论",
  国际声援行动: "国际声援行动"
};

export async function getHomeNews(channelNames: string[]): Promise<HomeNewsLive> {
  const empty: HomeNewsLive = { lead: null, leadIsFlagged: false, items: [], channelLeads: new Map() };
  try {
    const supabase = createSupabaseAdminClient();

    const newest = async (build: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>, limit: number) => {
      const { data } = await build(baseQuery());
      return ((data ?? []) as unknown as Record<string, unknown>[]).slice(0, limit);
    };
    const baseQuery = () =>
      supabase
        .from("cms_articles")
        .select(NEWS_CARD_COLUMNS)
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });

    const { data: flagged } = await baseQuery().eq("featured", true).limit(1);
    const flaggedRows = (flagged ?? []) as unknown as Record<string, unknown>[];
    const leadIsFlagged = flaggedRows.length > 0;

    // One row more than needed, so dropping the lead still leaves three.
    const { data: recent } = await baseQuery().limit(5);
    const recentRows = (recent ?? []) as unknown as Record<string, unknown>[];

    const leadRow = leadIsFlagged ? flaggedRows[0] : recentRows[0];
    if (!leadRow) return empty;
    const leadSlug = String(leadRow.slug);
    const itemRows = recentRows.filter((row) => String(row.slug) !== leadSlug).slice(0, 3);

    const names = await primaryCategoryNames(
      [leadRow, ...itemRows].map((row) => String(row.slug))
    );
    const lead = toNewsCard(leadRow, names.get(leadSlug) ?? "");
    const items = itemRows.map((row) => toNewsCard(row, names.get(String(row.slug)) ?? ""));

    // One latest article per column the homepage asks for.
    const channelLeads = new Map<string, { card: NewsCard | null; slug: string }>();
    await Promise.all(
      channelNames.map(async (asked) => {
        const wanted = CHANNEL_NAME_ALIASES[asked] ?? asked;
        const meta = NEWS_CATEGORIES.find((row) => row.name === wanted);
        if (!meta) return;
        // Two, so a column whose newest article is already the page lead can
        // show the next one instead of printing the same story twice.
        const listing = await getNewsListing(meta.slug, 1, "latest", 2);
        const pick =
          (listing?.items ?? []).find((item) => item.slug !== leadSlug) ?? listing?.items[0] ?? null;
        channelLeads.set(asked, { card: pick, slug: meta.slug });
      })
    );

    return { lead, leadIsFlagged, items, channelLeads };
  } catch {
    return empty;
  }
}

/**
 * The homepage's 影音节目 band, read live from the video table.
 *
 * Hand-typed like the news block was, and stale the same way: the feature and
 * all four cards linked to youtube.com, zhuichaguoji.org or the old tuidang.org
 * rather than to our own video pages.
 */
export interface HomeVideoLive {
  feature: PublicVideoCard | null;
  featureIsFlagged: boolean;
  featureCategory: string;
  /** The four newest, never repeating the feature. */
  items: { card: PublicVideoCard; category: string }[];
}

export async function getHomeVideo(): Promise<HomeVideoLive> {
  const empty: HomeVideoLive = { feature: null, featureIsFlagged: false, featureCategory: "", items: [] };
  try {
    const supabase = createSupabaseAdminClient();
    const columns =
      "id, slug, title, episode, description, cover_image, duration_seconds, published_at, source_url";
    const base = () =>
      supabase
        .from("cms_videos")
        .select(columns)
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });

    const { data: flagged } = await base().eq("featured", true).neq("cover_image", "").limit(1);
    const flaggedRows = (flagged ?? []) as unknown as Record<string, unknown>[];
    const featureIsFlagged = flaggedRows.length > 0;

    // One spare, so dropping the feature still leaves four.
    const { data: recent } = await base().neq("cover_image", "").limit(6);
    const recentRows = (recent ?? []) as unknown as Record<string, unknown>[];

    const featureRow = featureIsFlagged ? flaggedRows[0] : recentRows[0];
    if (!featureRow) return empty;

    const toCard = (row: Record<string, unknown>): PublicVideoCard => ({
      slug: String(row.slug),
      title: String(row.title),
      episode: String(row.episode ?? ""),
      description: String(row.description ?? ""),
      coverImage: String(row.cover_image ?? ""),
      durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      publishedAt: row.published_at ? String(row.published_at) : null,
      sourceUrl: String(row.source_url ?? "")
    });

    const featureSlug = String(featureRow.slug);
    const itemRows = recentRows.filter((row) => String(row.slug) !== featureSlug).slice(0, 4);
    const categories = await primaryVideoCategoryNames(
      [featureRow, ...itemRows].map((row) => String(row.id))
    );

    return {
      feature: toCard(featureRow),
      featureIsFlagged,
      featureCategory: categories.get(String(featureRow.id)) ?? "",
      items: itemRows.map((row) => ({
        card: toCard(row),
        category: categories.get(String(row.id)) ?? ""
      }))
    };
  } catch {
    return empty;
  }
}

/** Primary category name per video id, in one round trip. */
async function primaryVideoCategoryNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_video_category_map")
      .select("video_id, position, cms_video_categories(name)")
      .in("video_id", unique)
      .order("position", { ascending: true });
    const out = new Map<string, string>();
    for (const row of data ?? []) {
      const videoId = String((row as { video_id: string }).video_id);
      // position ascending, so the first row seen for a video is its primary.
      if (out.has(videoId)) continue;
      const name = (row as { cms_video_categories?: { name?: string } }).cms_video_categories?.name;
      if (name) out.set(videoId, String(name));
    }
    return out;
  } catch {
    return new Map();
  }
}

export interface NewsListing {
  slug: string;
  name: string;
  en: string;
  items: NewsCard[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: NewsSort;
  /**
   * 编辑精选 for the sidebar: the 精彩保留 articles inside this listing's scope.
   *
   * The design's rail is headed 本栏最热. Nothing records how often an article is
   * read, so there is no ranking to show there; the editors' own picks are real,
   * already curated, and the nearest thing the data actually supports.
   */
  picks: NewsCard[];
}

/** See VideoSort: 最热 is not offered, for the same reason. */
export type NewsSort = "latest" | "oldest";

/**
 * Listings that are not categories: the whole section, and the two editorial
 * flags. They share the category page, so 最新发布 and 精彩保留 lead somewhere
 * real instead of dead-ending on the homepage strip.
 */
const NEWS_VIRTUAL_LISTINGS: Record<string, { name: string; en: string; filter?: "featured" | "editor_archive" }> = {
  archive: { name: "全部文章", en: "ALL ARTICLES" },
  latest: { name: "最新发布", en: "LATEST" },
  featured: { name: "重要报导", en: "FEATURED", filter: "featured" },
  "editor-archive": { name: "精彩保留", en: "EDITOR'S PICKS", filter: "editor_archive" }
};

/**
 * One category's articles, paged — what the tab row and every 更多 → lead to.
 *
 * `archive` is the whole section rather than a category, so 查看全部 under
 * 最新发布 has somewhere real to go.
 */
export async function getNewsListing(
  slug: string,
  page = 1,
  sort: NewsSort = "latest",
  // 13 fills the design: one lead card, twelve in the list beneath it.
  pageSize = 13
): Promise<NewsListing | null> {
  const virtual = NEWS_VIRTUAL_LISTINGS[slug];
  const meta = NEWS_CATEGORIES.find((row) => row.slug === slug);
  if (!virtual && !meta) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const offset = (Math.max(page, 1) - 1) * pageSize;

    let categoryId = "";
    if (!virtual) {
      const { data } = await supabase
        .from("cms_article_categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) return null;
      categoryId = String(data.id);
    }

    /** Every query on this page shares the same scope; only the columns differ. */
    const scoped = (columns: string, withCount: boolean) => {
      const base = virtual
        ? supabase.from("cms_articles").select(columns, withCount ? { count: "exact" } : undefined)
        : supabase
            .from("cms_articles")
            .select(
              `${columns}, cms_article_category_map!inner(category_id)`,
              withCount ? { count: "exact" } : undefined
            )
            .eq("cms_article_category_map.category_id", categoryId);
      const filtered = base.eq("status", "published");
      return virtual?.filter ? filtered.eq(virtual.filter, true) : filtered;
    };

    const [listResult, picksResult] = await Promise.all([
      scoped(NEWS_CARD_COLUMNS, true)
        .order("published_at", { ascending: sort === "oldest", nullsFirst: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1),
      // The sidebar rail. Skipped where it would only repeat the main list.
      virtual?.filter === "editor_archive"
        ? Promise.resolve({ data: [] })
        : scoped(NEWS_CARD_COLUMNS, false)
            .eq("editor_archive", true)
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: true })
            .limit(5)
    ]);

    const name = virtual ? virtual.name : meta!.name;
    const rows = (listResult.data ?? []) as unknown as Record<string, unknown>[];
    const pickRows = (picksResult.data ?? []) as unknown as Record<string, unknown>[];
    const total = listResult.count ?? 0;

    // A category page's cards all share its name; the section-wide listings hold
    // articles from every category, so each card carries its own.
    const kickers = virtual
      ? await primaryCategoryNames([...rows, ...pickRows].map((row) => String(row.slug)))
      : new Map<string, string>();
    const kickerFor = (row: Record<string, unknown>) =>
      virtual ? kickers.get(String(row.slug)) ?? "" : name;

    return {
      slug,
      name,
      en: virtual ? virtual.en : meta!.en,
      items: rows.map((row) => toNewsCard(row, kickerFor(row))),
      picks: pickRows.map((row) => toNewsCard(row, kickerFor(row))),
      total,
      page: Math.max(page, 1),
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
      sort
    };
  } catch {
    return null;
  }
}

export interface VideoHome {
  /** The one film the page opens with. */
  feature: PublicVideoCard | null;
  featureCategory: string;
  /**
   * True when the feature is a film an editor flagged 重要.
   *
   * False means nothing is flagged and the page fell back to the newest film
   * with a cover, so it must not be labelled 重要 -- the badge would be
   * asserting an editorial decision nobody made.
   */
  featureIsFlagged: boolean;
  /** 最新上线 — newest across every series. */
  upnext: PublicVideoCard[];
  shelves: VideoLibraryShelf[];
  total: number;
}

/**
 * Everything the video landing page shows.
 *
 * The feature is the newest video that actually has a cover: the design leans
 * on a full-bleed image, and a card with nothing behind the gradient is worse
 * than the second-newest film.
 */
export async function getVideoHome(): Promise<VideoHome> {
  try {
    const supabase = createSupabaseAdminClient();
    const shelves = await getVideoLibrary(9);

    const featureColumns =
      "slug, title, episode, description, cover_image, duration_seconds, published_at, source_url";
    // The newest film flagged 重要. Falls back to the newest with a cover when
    // nothing is flagged, so the page always opens with something.
    const { data: flaggedRows } = await supabase
      .from("cms_videos")
      .select(featureColumns)
      .eq("status", "published")
      .eq("featured", true)
      .neq("cover_image", "")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(1);
    const featureIsFlagged = (flaggedRows ?? []).length > 0;
    const { data: featureRows } = featureIsFlagged
      ? { data: flaggedRows }
      : await supabase
          .from("cms_videos")
          .select(featureColumns)
          .eq("status", "published")
          .neq("cover_image", "")
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(1);

    const { data: upnextRows } = await supabase
      .from("cms_videos")
      .select("slug, title, episode, description, cover_image, duration_seconds, published_at, source_url")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(5);

    const toCard = (row: Record<string, unknown>): PublicVideoCard => ({
      slug: String(row.slug),
      title: String(row.title),
      episode: String(row.episode ?? ""),
      description: String(row.description ?? ""),
      coverImage: String(row.cover_image ?? ""),
      durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      publishedAt: row.published_at ? String(row.published_at) : null,
      sourceUrl: String(row.source_url ?? "")
    });

    const feature = ((featureRows ?? []) as unknown as Record<string, unknown>[]).map(toCard)[0] ?? null;
    const featureShelf = feature
      ? shelves.find((shelf) => shelf.videos.some((video) => video.slug === feature.slug))
      : undefined;

    return {
      feature,
      featureCategory: featureShelf?.name ?? "",
      featureIsFlagged,
      upnext: ((upnextRows ?? []) as unknown as Record<string, unknown>[]).map(toCard),
      shelves,
      total: shelves.reduce((sum, shelf) => sum + shelf.total, 0)
    };
  } catch {
    return { feature: null, featureCategory: "", featureIsFlagged: false, upnext: [], shelves: [], total: 0 };
  }
}

/* ==========================================================================
   真相点资料 — the downloadable materials.

   Read straight from `cms_materials`, so the counts on /resources/downloads are
   counted rather than typed. Everything degrades to empty rather than throwing:
   before 017 is run the page shows its static copy and no cards.
   ========================================================================== */

export interface PublicMaterialFile {
  label: string;
  url: string;
  kind: string;
}

export interface PublicMaterial {
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  coverImage: string;
  coverImageAlt: string;
  files: PublicMaterialFile[];
  publishedAt: string | null;
  categorySlug: string;
  categoryName: string;
}

export interface PublicMaterialCategory {
  slug: string;
  name: string;
  summary: string;
  count: number;
}

function materialFiles(value: unknown): PublicMaterialFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      label: asString(row.label),
      url: asString(row.url),
      kind: asString(row.kind)
    }))
    // A row with no address is how an editor retires a download, so it must not
    // reach the page as a dead button.
    .filter((row) => row.url);
}

type MaterialRow = {
  slug: unknown;
  title: unknown;
  summary: unknown;
  body_markdown?: unknown;
  cover_image: unknown;
  cover_image_alt: unknown;
  files: unknown;
  published_at: unknown;
  cms_material_category_map?: unknown;
};

function toPublicMaterial(row: MaterialRow): PublicMaterial {
  const maps = Array.isArray(row.cms_material_category_map) ? row.cms_material_category_map : [];
  const primary = maps
    .slice()
    .sort(
      (a, b) =>
        Number((a as { position?: number }).position ?? 0) - Number((b as { position?: number }).position ?? 0)
    )[0] as { cms_material_categories?: { slug?: string; name?: string } } | undefined;
  return {
    slug: asString(row.slug),
    title: asString(row.title),
    summary: asString(row.summary),
    bodyMarkdown: asString(row.body_markdown),
    coverImage: asString(row.cover_image),
    coverImageAlt: asString(row.cover_image_alt),
    files: materialFiles(row.files),
    publishedAt: row.published_at ? asString(row.published_at) : null,
    categorySlug: asString(primary?.cms_material_categories?.slug),
    categoryName: asString(primary?.cms_material_categories?.name)
  };
}

const MATERIAL_SELECT =
  "slug, title, summary, body_markdown, cover_image, cover_image_alt, files, published_at, cms_material_category_map(position, cms_material_categories(slug, name))";

export async function getMaterialCategories(): Promise<PublicMaterialCategory[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: categories, error }, { data: maps, error: mapError }] = await Promise.all([
      supabase
        .from("cms_material_categories")
        .select("slug, name, summary, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("cms_material_category_map")
        .select("cms_material_categories!inner(slug), cms_materials!inner(status)")
        .eq("cms_materials.status", "published")
    ]);
    if (error || mapError) return [];

    const counts = new Map<string, number>();
    for (const row of maps ?? []) {
      const slug = String(
        (row as { cms_material_categories?: { slug?: string } }).cms_material_categories?.slug ?? ""
      );
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return (categories ?? []).map((row) => ({
      slug: asString(row.slug),
      name: asString(row.name),
      summary: asString(row.summary),
      count: counts.get(asString(row.slug)) ?? 0
    }));
  } catch {
    return [];
  }
}

export async function getMaterialsByCategory(categorySlug?: string): Promise<PublicMaterial[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_materials")
      .select(MATERIAL_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(500);
    if (error || !data) return [];
    const rows = data.map((row) => toPublicMaterial(row as MaterialRow));
    return categorySlug ? rows.filter((row) => row.categorySlug === categorySlug) : rows;
  } catch {
    return [];
  }
}

export async function getMaterial(slug: string): Promise<PublicMaterial | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_materials")
      .select(MATERIAL_SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) return null;
    return toPublicMaterial(data as MaterialRow);
  } catch {
    return null;
  }
}

/* ==========================================================================
   中华传统文化 — read from the article library rather than from page JSON.

   The page used to render ten hand-picked rows stored in
   `pages/resources-culture.json`, which left 304 of the 314 published articles
   unreachable, claimed 68 pages that all returned the same ten, and filtered by
   matching titles against hardcoded names. Counts in the sidebar added up to
   750 against 314 real articles.
   ========================================================================== */

/**
 * The filters. 诗词 and 歌曲 are real categories an editor reassigns in 文章管理;
 * 传统文化文章 is what is left over, so the three always sum to the whole.
 *
 * Named 传统文化文章 rather than plain 文章 because the admin lists it beside the
 * news categories, where a bare 文章 says nothing about which library it means.
 */
export const CULTURE_FILTERS = [
  { key: "all", label: "全部", slug: "culture" },
  { key: "article", label: "传统文化文章", slug: "" },
  { key: "poetry", label: "诗词", slug: "culture-poetry" },
  { key: "music", label: "歌曲", slug: "culture-music" }
] as const;

export interface CultureRow {
  slug: string;
  title: string;
  summary: string;
  image: string;
  date: string;
  tag: string;
}

export interface CultureListing {
  rows: CultureRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: { all: number; article: number; poetry: number; music: number };
}

async function categoryIdBySlug(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  slug: string
): Promise<string> {
  const { data } = await supabase.from("cms_article_categories").select("id").eq("slug", slug).maybeSingle();
  return data ? String(data.id) : "";
}

export async function getCultureListing(filterKey = "all", page = 1, pageSize = 10): Promise<CultureListing> {
  const empty: CultureListing = {
    rows: [],
    total: 0,
    page: 1,
    pageSize,
    pageCount: 1,
    counts: { all: 0, article: 0, poetry: 0, music: 0 }
  };
  try {
    const supabase = createSupabaseAdminClient();
    const [plainId, poetryId, musicId] = await Promise.all([
      categoryIdBySlug(supabase, "culture"),
      categoryIdBySlug(supabase, "culture-poetry"),
      categoryIdBySlug(supabase, "culture-music")
    ]);
    if (!plainId) return empty;

    const countIn = async (categoryId: string) => {
      if (!categoryId) return 0;
      const { count } = await supabase
        .from("cms_article_category_map")
        .select("article_id, cms_articles!inner(status)", { count: "exact", head: true })
        .eq("category_id", categoryId)
        .eq("cms_articles.status", "published");
      return count ?? 0;
    };
    const [article, poetry, music] = await Promise.all([
      countIn(plainId),
      countIn(poetryId),
      countIn(musicId)
    ]);
    // The three are siblings and every article is in exactly one, so 全部 is
    // their sum rather than a separate category to keep in step.
    const counts = { article, poetry, music, all: article + poetry + music };

    const filter = CULTURE_FILTERS.find((row) => row.key === filterKey) ?? CULTURE_FILTERS[0];
    const total =
      filter.key === "all" ? counts.all
      : filter.key === "poetry" ? counts.poetry
      : filter.key === "music" ? counts.music
      : counts.article;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, page), pageCount);

    const scope =
      filter.key === "all"
        ? [plainId, poetryId, musicId].filter(Boolean)
        : [filter.key === "poetry" ? poetryId : filter.key === "music" ? musicId : plainId].filter(Boolean);
    if (scope.length === 0) return { ...empty, counts };

    const nameById = new Map<string, string>([
      [plainId, "传统文化文章"],
      [poetryId, "诗词"],
      [musicId, "歌曲"]
    ]);

    const { data } = await supabase
      .from("cms_articles")
      .select(
        "slug, title, summary, hero_image, published_at, cms_article_category_map!inner(category_id)"
      )
      .eq("status", "published")
      .in("cms_article_category_map.category_id", scope)
      .order("published_at", { ascending: false, nullsFirst: false })
      // A tiebreaker: the import wrote whole batches on one timestamp, and
      // without this the pager repeats and drops rows.
      .order("id", { ascending: true })
      .range((current - 1) * pageSize, current * pageSize - 1);

    const rows: CultureRow[] = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const maps = Array.isArray(r.cms_article_category_map) ? r.cms_article_category_map : [];
      const categoryId = String((maps[0] as { category_id?: string })?.category_id ?? "");
      return {
        slug: asString(r.slug),
        title: asString(r.title),
        summary: asString(r.summary),
        image: asString(r.hero_image),
        date: asString(r.published_at).slice(0, 10),
        // The row's own category, so 全部 shows which bucket each one is in.
        tag: nameById.get(categoryId) ?? "传统文化文章"
      };
    });

    return { rows, total, page: current, pageSize, pageCount, counts };
  } catch {
    return empty;
  }
}

/** One category and its published questions, in the order an editor set. */
export interface PublicFaqItem {
  slug: string;
  question: string;
  answerMarkdown: string;
}

export interface PublicFaqGroup {
  slug: string;
  name: string;
  summary: string;
  /** Every published question in the category. */
  items: PublicFaqItem[];
  /** How many there are, which the card shows even when the list is trimmed. */
  total: number;
}

/**
 * The FAQ, grouped by category.
 *
 * Returns an empty list when migration 023 has not been applied, so the page
 * falls back to whatever the stored entry holds rather than erroring.
 *
 * `search` filters on the question text, which is what the index's search box
 * submits. Matching on the answer as well would return cards whose visible
 * question has nothing to do with the words typed.
 */
export async function getPublicFaq(search = ""): Promise<PublicFaqGroup[]> {
  const supabase = createSupabaseAdminClient();
  const { data: categories, error } = await supabase
    .from("cms_faq_categories")
    .select("id, slug, name, summary, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !categories) return [];

  let query = supabase
    .from("cms_faqs")
    .select("slug, question, answer_markdown, category_id, position")
    .eq("status", "published");
  const term = search.trim();
  if (term) query = query.ilike("question", `%${term}%`);
  const { data: rows } = await query.order("position", { ascending: true });

  const byCategory = new Map<string, PublicFaqItem[]>();
  for (const row of rows ?? []) {
    const key = String(row.category_id ?? "");
    const bucket = byCategory.get(key) ?? [];
    bucket.push({
      slug: String(row.slug),
      question: String(row.question),
      answerMarkdown: String(row.answer_markdown ?? "")
    });
    byCategory.set(key, bucket);
  }

  return categories
    .map((category) => {
      const items = byCategory.get(String(category.id)) ?? [];
      return {
        slug: String(category.slug),
        name: String(category.name),
        summary: String(category.summary ?? ""),
        items,
        total: items.length
      };
    })
    .filter((group) => group.items.length > 0);
}

/** One question, with the category it sits in, for its own page. */
export async function getPublicFaqItem(
  slug: string
): Promise<{ item: PublicFaqItem; category: { slug: string; name: string } } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_faqs")
    .select("slug, question, answer_markdown, category_id")
    .eq("slug", decodeURIComponent(slug))
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;

  const { data: category } = await supabase
    .from("cms_faq_categories")
    .select("slug, name")
    .eq("id", data.category_id)
    .maybeSingle();

  return {
    item: {
      slug: String(data.slug),
      question: String(data.question),
      answerMarkdown: String(data.answer_markdown ?? "")
    },
    category: { slug: String(category?.slug ?? ""), name: String(category?.name ?? "未分类") }
  };
}

/** Every question of one category, for its "了解更多" page. */
export async function getPublicFaqCategory(slug: string): Promise<PublicFaqGroup | null> {
  const groups = await getPublicFaq();
  return groups.find((group) => group.slug === decodeURIComponent(slug)) ?? null;
}

/**
 * The current address of an imported answer, by the doc id its old URL used.
 *
 * Links across the site are written as `/services/faq/d/<id>` rather than as
 * the question text, because the slug IS the question and an editor rewording
 * it would break every link pointing at it. The id never changes.
 */
export async function getPublicFaqSlugByLegacyId(legacyId: number): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_faqs")
    .select("slug")
    .eq("legacy_id", legacyId)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return String(data.slug);
}

/**
 * The current address of an article, found by the post id the old site used.
 *
 * Page content links to articles as `/news/a/<id>` for the same reason the FAQ
 * uses `/services/faq/d/<id>`: an article's slug is its Chinese title, so
 * retitling one in the new admin would otherwise break every card and episode
 * row pointing at it. See [[getPublicFaqSlugByLegacyId]].
 */
export async function getArticleSlugByLegacyId(legacyId: number): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_articles")
    .select("slug")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  if (error || !data) return null;
  return String(data.slug);
}
