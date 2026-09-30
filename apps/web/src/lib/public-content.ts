import {
  pageRouteToContentPath,
  prototypePageContentSeeds,
  routeSeeds,
  type TemplateKind
} from "@quitccp/content-schema";
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
  "long-form"
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

type ArticleBodyRow =
  | { type: "p" | "h2" | "h3" | "blockquote"; text: string }
  | { type: "figure"; src: string; alt: string }
  | { type: "video"; src: string; caption: string }
  | { type: "table"; head: string[]; rows: string[][] };

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
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

function markdownToBodyRows(markdown: string): ArticleBodyRow[] {
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
      const text = stripInlineMarkdown(line.replace(/^#{1,2}\s+/, ""));
      if (text) rows.push({ type: "h2", text });
      continue;
    }
    if (isLikelyStandaloneSubheading(lines, index)) {
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
    const cleaned = stripInlineMarkdown(line);
    if (cleaned) paragraphBuffer.push(cleaned);
    if (embedded.length > 0) {
      flushParagraph();
      for (const match of embedded) rows.push({ type: "figure", src: match[2], alt: match[1] });
    }
  }

  flushParagraph();
  flushQuote();
  return rows;
}

function extractFirstImageFromMarkdown(markdown: string): string {
  const markdownMatch = markdown.match(/!\[[^\]]*]\((https?:\/\/[^\s)]+)(?:\s+\"[^\"]*\")?\)/);
  if (markdownMatch?.[1]) return markdownMatch[1];
  const htmlMatch = markdown.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch?.[1]) return htmlMatch[1];
  return "";
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
      .select("id, slug, title, summary, body_markdown, body_plain, status, updated_at, published_at, author")
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
    const fallbackContent = asObject(fallback.content);
    if (!data) {
      const virtual = listMapped;
      if (!virtual) return normalizedSlug === "article" ? fallback : null;
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

    const markdownBody = asString(data.body_markdown);
    const plainBody = asString(data.body_plain);
    const markdownRows = markdownToBodyRows(markdownBody);
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
    const summary = asString(
      data.summary,
      firstParagraph && "text" in firstParagraph ? firstParagraph.text : ""
    );
    const heroImage = asString(listMapped?.image) || extractFirstImageFromMarkdown(markdownBody);
    // The article's own primary category, which nothing here used to consult.
    // Without it every article fell through to the template's default and the
    // whole site claimed to be 国际声援行动.
    const primaryCategory = await primaryCategoryName(String(data.id));
    const articleTag =
      primaryCategory || asString(listMapped?.tag, asString(fallbackContent.tag, "新闻与报告"));
    // Date the article by when it was published, not when we last wrote the row.
    // The import touched all 15,514 rows at once, so updated_at would have put
    // today's date on a piece from 2011.
    const articleDate = asString(data.published_at) || asString(data.updated_at);
    const resolvedByline = [
      toDateLabel(articleDate),
      articleTag || "新闻与报告",
      asString(data.author) || "本站资料库",
      `约 ${plainBody.length.toLocaleString("zh-CN")} 字`
    ];
    return {
      section: "news",
      slug: String(data.slug),
      title: String(data.title),
      template: "article",
      summary: summary || "article",
      locale: "zh",
      contentPath: "pages/news-article.json",
      content: {
        ...fallbackContent,
        title: String(data.title),
        // The importer set summary to the first 240 characters of the body, so
        // showing it as the standfirst reprints the opening paragraph directly
        // above itself. Only show a standfirst that says something the body
        // does not already open with.
        dek: isEchoOfBody(summary, firstParagraph && "text" in firstParagraph ? firstParagraph.text : "")
          ? ""
          : summary || asString(fallbackContent.dek),
        byline: resolvedByline,
        body: bodyRows,
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
        breadcrumb: {
          ...asObject(fallbackContent.breadcrumb),
          sectionLabel: "新闻与报告",
          sectionHref: "/news",
          current: articleTag
        },
        heroFigure: heroImage
          ? {
              ...asObject(fallbackContent.heroFigure),
              image: heroImage,
              alt: String(data.title),
              captionLines: listMapped?.meta ? [String(listMapped.meta), "图像与列表卡片一致"] : []
            }
          : {},
        inlineFigure: {}
      }
    };
  } catch {
    return normalizedSlug === "article" ? fallback : null;
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
      .select("position, cms_video_categories(name)")
      .eq("video_id", row.id as string)
      .order("position", { ascending: true });
    const category =
      (mapRows ?? [])
        .map((row) => (row as { cms_video_categories?: { name?: string } }).cms_video_categories?.name)
        .find(Boolean) ?? "";

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
      category: String(category)
    };
  } catch {
    return null;
  }
}


/**
 * The name of an article's primary category -- the row at position 0 in the
 * category map, which is what the admin shows and what migration 011 exists to
 * make deterministic.
 */
async function primaryCategoryName(articleId: string): Promise<string> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_article_category_map")
      .select("position, cms_article_categories(name)")
      .eq("article_id", articleId)
      .order("position", { ascending: true })
      .limit(1);
    const name = (data ?? [])
      .map((row) => (row as { cms_article_categories?: { name?: string } }).cms_article_categories?.name)
      .find(Boolean);
    return name ? String(name) : "";
  } catch {
    return "";
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
  videos: PublicVideoCard[];
}

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
  pageSize = 24
): Promise<PublicVideoCategory | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: category } = await supabase
      .from("cms_video_categories")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();
    if (!category) return null;

    const offset = (Math.max(page, 1) - 1) * pageSize;
    const { data, count, error } = await supabase
      .from("cms_videos")
      .select(
        "id, slug, title, episode, description, cover_image, duration_seconds, published_at, source_url, " +
          "cms_video_category_map!inner(category_id)",
        { count: "exact" }
      )
      .eq("cms_video_category_map.category_id", category.id)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) return null;

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const total = count ?? 0;
    return {
      slug: String(category.slug),
      name: String(category.name),
      total,
      page: Math.max(page, 1),
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
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
      const page = await getVideoCategory(category.slug, 1, perShelf);
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
 * at a fixed character count and usually ends mid-sentence.
 */
function isEchoOfBody(summary: string, firstParagraph: string): boolean {
  const normalise = (value: string) => value.replace(/[\s，。、；：""''《》（）()!?！？…—-]/g, "");
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

export interface NewsListing {
  slug: string;
  name: string;
  en: string;
  items: NewsCard[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * One category's articles, paged — what the tab row and every 更多 → lead to.
 *
 * `archive` is the whole section rather than a category, so 查看全部 under
 * 最新发布 has somewhere real to go.
 */
export async function getNewsListing(
  slug: string,
  page = 1,
  pageSize = 24
): Promise<NewsListing | null> {
  const isArchive = slug === "archive";
  const meta = NEWS_CATEGORIES.find((row) => row.slug === slug);
  if (!isArchive && !meta) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const offset = (Math.max(page, 1) - 1) * pageSize;

    let categoryId = "";
    if (!isArchive) {
      const { data } = await supabase
        .from("cms_article_categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) return null;
      categoryId = String(data.id);
    }

    const query = isArchive
      ? supabase
          .from("cms_articles")
          .select(NEWS_CARD_COLUMNS, { count: "exact" })
          .eq("status", "published")
      : supabase
          .from("cms_articles")
          .select(`${NEWS_CARD_COLUMNS}, cms_article_category_map!inner(category_id)`, {
            count: "exact"
          })
          .eq("cms_article_category_map.category_id", categoryId)
          .eq("status", "published");

    const { data, count } = await query
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    const name = isArchive ? "全部文章" : meta!.name;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const total = count ?? 0;
    return {
      slug,
      name,
      en: isArchive ? "ALL ARTICLES" : meta!.en,
      items: rows.map((row) => toNewsCard(row, name)),
      total,
      page: Math.max(page, 1),
      pageCount: Math.max(1, Math.ceil(total / pageSize))
    };
  } catch {
    return null;
  }
}
