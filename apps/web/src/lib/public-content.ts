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

type ArticleBodyRow = { type: "p" | "h2" | "h3" | "blockquote"; text: string };

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
    if (/^!\[[^\]]*]\(([^)]+)\)$/.test(line) || /^<img\b/i.test(line)) {
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

    const cleaned = stripInlineMarkdown(line);
    if (cleaned) paragraphBuffer.push(cleaned);
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
      .in("status", ["published", "review", "draft"])
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
    const summary = asString(data.summary, bodyRows.find((row) => row.type === "p")?.text ?? "");
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
        dek: summary || asString(fallbackContent.dek),
        byline: resolvedByline,
        body: bodyRows,
        tag: articleTag,
        // The seed's breadcrumb names a category too, and the template prefers
        // it over the tag -- so it has to be corrected here as well or the trail
        // keeps claiming a section the article is not in.
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
