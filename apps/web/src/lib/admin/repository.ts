import { randomUUID } from "node:crypto";
import { routeSeeds } from "@quitccp/content-schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import type {
  ArticleRecord,
  AuditRecord,
  CategoryRecord,
  MediaRecord,
  PageRecord,
  RevisionRecord,
  SettingRecord,
  VideoRecord
} from "./types";

type PageStatus = "draft" | "review" | "published" | "archived";

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

/**
 * Category slugs stay latin: they appear in URLs, and a CJK slug would be
 * percent-encoded into something unreadable and awkward to share. `toSlug`
 * keeps CJK, so a Chinese name with no slug given would produce one -- hence
 * the explicit check rather than relying on it.
 */
function resolveCategorySlug(name: string, given?: string): string {
  const explicit = given?.trim().toLowerCase();
  if (explicit) return explicit;
  const generated = toSlug(name).toLowerCase();
  if (!/[a-z0-9]/.test(generated)) {
    throw new Error("请为中文分类名填写英文 slug（用于网址）。");
  }
  return generated;
}

function resolveTemplateKind(section: string, slug: string) {
  const seed = routeSeeds.find((row) => row.section === section && row.slug === slug);
  return seed?.template ?? "section-home";
}

async function createAudit(
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  accessMode: "read" | "write",
  detail: Record<string, unknown> = {}
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("cms_audit_logs").insert({
    actor_email: actorEmail,
    action,
    target_type: targetType,
    target_id: targetId,
    access_mode: accessMode,
    detail
  });
}

async function createRevision(
  entityType: "page" | "article",
  entityId: string,
  actorEmail: string,
  payload: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("cms_revisions").insert({
    entity_type: entityType,
    entity_id: entityId,
    payload,
    actor_email: actorEmail
  });
}

function parseBlocksJson(blocksJson: string): unknown[] {
  try {
    const parsed = JSON.parse(blocksJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function seedPagesIfEmpty(actorEmail = "system@quitccp.local") {
  const supabase = createSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from("cms_pages")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const rows = routeSeeds.map((seed) => ({
    section: seed.section,
    slug: seed.slug,
    locale: "zh",
    title: seed.title,
    template_kind: seed.template,
    status: "draft",
    blocks: [{ id: "hero", type: "hero", title: seed.title }],
    seo: {}
  }));

  const { error } = await supabase
    .from("cms_pages")
    .upsert(rows, { onConflict: "section,slug,locale", ignoreDuplicates: true });
  if (error) throw error;
  await createAudit(actorEmail, "page.seed", "page", "bulk-seed", "write", { count: rows.length });
}

export async function listPages(actorEmail = "system@quitccp.local"): Promise<PageRecord[]> {
  await seedPagesIfEmpty(actorEmail);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_pages")
    .select("id, section, slug, title, locale, status, blocks, updated_at")
    .order("section")
    .order("slug");
  if (error) throw error;
  await createAudit(actorEmail, "page.list", "page", "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    section: String(row.section),
    slug: String(row.slug),
    title: String(row.title),
    locale: String(row.locale),
    status: row.status as PageStatus,
    blocksJson: JSON.stringify(row.blocks ?? []),
    updatedAt: String(row.updated_at)
  }));
}

export async function upsertPageRecord(
  input: Omit<PageRecord, "updatedAt">,
  actorEmail: string
): Promise<PageRecord> {
  const supabase = createSupabaseAdminClient();
  const payload = {
    section: input.section,
    slug: input.slug,
    locale: input.locale || "zh",
    title: input.title,
    template_kind: resolveTemplateKind(input.section, input.slug),
    status: input.status,
    blocks: parseBlocksJson(input.blocksJson)
  };

  const { data, error } = await supabase
    .from("cms_pages")
    .upsert(payload, { onConflict: "section,slug,locale" })
    .select("id, section, slug, title, locale, status, blocks, updated_at")
    .single();
  if (error) throw error;

  await createRevision("page", String(data.id), actorEmail, { record: data });
  await createAudit(actorEmail, "page.upsert", "page", String(data.id), "write", {
    section: data.section,
    slug: data.slug
  });

  return {
    id: String(data.id),
    section: String(data.section),
    slug: String(data.slug),
    title: String(data.title),
    locale: String(data.locale),
    status: data.status as PageStatus,
    blocksJson: JSON.stringify(data.blocks ?? []),
    updatedAt: String(data.updated_at)
  };
}

export interface ArticleListFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  locale?: string;
  category?: string;
  q?: string;
  cursor?: string;
}

function decodeArticleCursor(raw?: string): { updatedAt: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      updatedAt?: string;
    };
    if (!parsed.updatedAt) return null;
    return { updatedAt: String(parsed.updatedAt) };
  } catch {
    return null;
  }
}

function encodeArticleCursor(updatedAt: string): string {
  return Buffer.from(JSON.stringify({ updatedAt }), "utf8").toString("base64url");
}

export async function listArticles(
  filters: ArticleListFilters,
  actorEmail: string
): Promise<{
  rows: ArticleRecord[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor: string | null;
  cursorApplied: boolean;
}> {
  const supabase = createSupabaseAdminClient();
  const cursor = decodeArticleCursor(filters.cursor);
  const useCursor = Boolean(cursor);
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.max(filters.pageSize ?? 20, 1);
  const offset = useCursor ? 0 : (page - 1) * pageSize;
  const articleSelect =
    "id, slug, title, section, locale, status, legacy_url, legacy_id, updated_at, summary";

  let rowsData: any[] = [];
  let totalRows = 0;
  const cursorApplied = useCursor;
  let hasMore = false;
  if (filters.category) {
    const categoryName = filters.category.trim();
    const categorySlug = toSlug(categoryName);
    const { data: categories } = await supabase
      .from("cms_article_categories")
      .select("id")
      .or(`name.eq.${categoryName},slug.eq.${categorySlug}`)
      .limit(1);
    if (!categories || categories.length === 0) {
      await createAudit(actorEmail, "article.list", "article", "query", "read", { filters, total: 0 });
      return { rows: [], total: 0, page, pageSize, nextCursor: null, cursorApplied };
    }
    const categoryId = categories[0].id;
    const { data: mapped } = await supabase
      .from("cms_article_category_map")
      .select("article_id")
      .eq("category_id", categoryId);
    const articleIds = (mapped ?? []).map((row) => row.article_id);
    if (articleIds.length === 0) {
      await createAudit(actorEmail, "article.list", "article", "query", "read", { filters, total: 0 });
      return { rows: [], total: 0, page, pageSize, nextCursor: null, cursorApplied };
    }
    let categoryQuery = supabase
      .from("cms_article_category_map")
      .select(`article_id, cms_articles!inner(${articleSelect})`, { count: "exact" })
      .eq("category_id", categories[0].id)
      .order("updated_at", { ascending: false, foreignTable: "cms_articles" })
      .range(offset, offset + (useCursor ? pageSize : pageSize - 1));
    if (filters.status) categoryQuery = categoryQuery.eq("cms_articles.status", filters.status);
    if (filters.locale) categoryQuery = categoryQuery.eq("cms_articles.locale", filters.locale);
    if (cursor?.updatedAt) {
      categoryQuery = categoryQuery.lt("cms_articles.updated_at", cursor.updatedAt);
    }
    if (filters.q) {
      const q = filters.q.replace(/[%_]/g, " ");
      categoryQuery = categoryQuery.or(`title.ilike.%${q}%,body_plain.ilike.%${q}%`, {
        foreignTable: "cms_articles"
      });
    }
    const { data: categoryData, error: categoryError, count: categoryCount } = await categoryQuery;
    if (categoryError) throw categoryError;
    rowsData = (categoryData ?? [])
      .map((row) => (row as any).cms_articles)
      .filter(Boolean)
      .map((row) => row as Record<string, unknown>);
    if (useCursor && rowsData.length > pageSize) {
      hasMore = true;
      rowsData = rowsData.slice(0, pageSize);
    }
    totalRows = categoryCount ?? 0;
  } else {
    let query = supabase
      .from("cms_articles")
      .select(articleSelect, { count: "exact" })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false });
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.locale) query = query.eq("locale", filters.locale);
    if (filters.q) {
      const q = filters.q.replace(/[%_]/g, " ");
      query = query.or(`title.ilike.%${q}%,body_plain.ilike.%${q}%`);
    }
    if (cursor?.updatedAt) query = query.lt("updated_at", cursor.updatedAt);
    query = query.range(offset, offset + (useCursor ? pageSize : pageSize - 1));
    const { data, error, count } = await query;
    if (error) throw error;
    rowsData = data ?? [];
    if (useCursor && rowsData.length > pageSize) {
      hasMore = true;
      rowsData = rowsData.slice(0, pageSize);
    }
    totalRows = count ?? 0;
  }

  const ids = (rowsData ?? []).map((row) => row.id);
  const categoryByArticle = new Map<string, string>();
  const tagsByArticle = new Map<string, string[]>();

  if (ids.length > 0) {
    const { data: categoryRows } = await supabase
      .from("cms_article_category_map")
      .select("article_id, cms_article_categories(name)")
      .in("article_id", ids);
    for (const row of categoryRows ?? []) {
      const categoryName = (row as any).cms_article_categories?.name;
      if (categoryName) categoryByArticle.set(String((row as any).article_id), String(categoryName));
    }

    const { data: tagRows } = await supabase
      .from("cms_article_tag_map")
      .select("article_id, cms_article_tags(name)")
      .in("article_id", ids);
    for (const row of tagRows ?? []) {
      const articleId = String((row as any).article_id);
      const tagName = (row as any).cms_article_tags?.name;
      if (!tagName) continue;
      const list = tagsByArticle.get(articleId) ?? [];
      list.push(String(tagName));
      tagsByArticle.set(articleId, list);
    }
  }

  await createAudit(actorEmail, "article.list", "article", "query", "read", { filters });

  const lastRow = rowsData.length > 0 ? rowsData[rowsData.length - 1] : null;
  const nextCursor =
    hasMore || (!useCursor && page * pageSize < totalRows)
      ? lastRow?.updated_at
        ? encodeArticleCursor(String(lastRow.updated_at))
        : null
      : null;

  return {
    page,
    pageSize,
    total: totalRows,
    nextCursor,
    cursorApplied,
    rows: (rowsData ?? []).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      section: String(row.section),
      locale: String(row.locale),
      status: row.status as PageStatus,
      bodyMarkdown: "",
      bodyPlain: "",
      category: categoryByArticle.get(String(row.id)) ?? "news",
      tags: tagsByArticle.get(String(row.id)) ?? [],
      legacyUrl: row.legacy_url ? String(row.legacy_url) : undefined,
      legacyId: row.legacy_id ? Number(row.legacy_id) : undefined,
      updatedAt: String(row.updated_at)
    }))
  };
}

async function setArticleTaxonomy(articleId: string, category: string, tags: string[]) {
  const supabase = createSupabaseAdminClient();
  const categorySlug = toSlug(category);

  const { data: categoryData, error: categoryError } = await supabase
    .from("cms_article_categories")
    .upsert({ slug: categorySlug, name: category }, { onConflict: "slug" })
    .select("id")
    .single();
  if (categoryError) throw categoryError;

  await supabase.from("cms_article_category_map").delete().eq("article_id", articleId);
  await supabase.from("cms_article_category_map").insert({
    article_id: articleId,
    category_id: categoryData.id
  });

  await supabase.from("cms_article_tag_map").delete().eq("article_id", articleId);
  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag) continue;
    const slug = toSlug(tag);
    const { data: tagData, error: tagError } = await supabase
      .from("cms_article_tags")
      .upsert({ slug, name: tag }, { onConflict: "slug" })
      .select("id")
      .single();
    if (tagError) throw tagError;
    await supabase.from("cms_article_tag_map").insert({
      article_id: articleId,
      tag_id: tagData.id
    });
  }
}

export async function upsertArticleRecord(
  input: Omit<ArticleRecord, "updatedAt">,
  actorEmail: string
): Promise<ArticleRecord> {
  const supabase = createSupabaseAdminClient();
  const payload = {
    slug: input.slug,
    locale: input.locale || "zh",
    title: input.title,
    summary: input.bodyPlain.slice(0, 240),
    body_markdown: input.bodyMarkdown,
    body_plain: input.bodyPlain,
    section: input.section || "news",
    status: input.status,
    editorial_status: input.status,
    legacy_url: input.legacyUrl ?? null,
    legacy_id: input.legacyId ?? null
  };

  const { data, error } = await supabase
    .from("cms_articles")
    .upsert(payload, { onConflict: "slug,locale" })
    .select("id, slug, title, section, locale, status, body_markdown, body_plain, legacy_url, legacy_id, updated_at")
    .single();
  if (error) throw error;

  await setArticleTaxonomy(String(data.id), input.category, input.tags);
  await createRevision("article", String(data.id), actorEmail, {
    record: data,
    taxonomy: { category: input.category, tags: input.tags }
  });
  await createAudit(actorEmail, "article.upsert", "article", String(data.id), "write", {
    slug: data.slug,
    locale: data.locale
  });

  return {
    id: String(data.id),
    slug: String(data.slug),
    title: String(data.title),
    section: String(data.section),
    locale: String(data.locale),
    status: data.status as PageStatus,
    bodyMarkdown: String(data.body_markdown),
    bodyPlain: String(data.body_plain),
    category: input.category,
    tags: input.tags,
    legacyUrl: data.legacy_url ? String(data.legacy_url) : undefined,
    legacyId: data.legacy_id ? Number(data.legacy_id) : undefined,
    updatedAt: String(data.updated_at)
  };
}

export async function bulkUpdateArticleStatus(ids: string[], status: PageStatus, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("cms_articles")
    .update({ status, editorial_status: status })
    .in("id", ids);
  if (error) throw error;
  await createAudit(actorEmail, "article.bulk_status", "article", "bulk", "write", {
    ids,
    status
  });
}

export async function deleteArticleById(id: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const article = await getArticleById(id);
  if (!article) return false;

  const { error } = await supabase.from("cms_articles").delete().eq("id", id);
  if (error) throw error;
  await createAudit(actorEmail, "article.delete", "article", id, "write", {
    slug: article.slug,
    title: article.title
  });
  return true;
}

export async function getArticleById(id: string): Promise<ArticleRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_articles")
    .select("id, slug, title, section, locale, status, body_markdown, body_plain, legacy_url, legacy_id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let category = "news";
  let tags: string[] = [];
  const { data: categoryRows } = await supabase
    .from("cms_article_category_map")
    .select("cms_article_categories(name)")
    .eq("article_id", id)
    .limit(1);
  const maybeCategory = (categoryRows?.[0] as any)?.cms_article_categories?.name;
  if (maybeCategory) category = String(maybeCategory);

  const { data: tagRows } = await supabase
    .from("cms_article_tag_map")
    .select("cms_article_tags(name)")
    .eq("article_id", id);
  tags =
    (tagRows ?? [])
      .map((row) => (row as any)?.cms_article_tags?.name)
      .filter(Boolean)
      .map(String) ?? [];

  return {
    id: String(data.id),
    slug: String(data.slug),
    title: String(data.title),
    section: String(data.section),
    locale: String(data.locale),
    status: data.status as PageStatus,
    bodyMarkdown: String(data.body_markdown ?? ""),
    bodyPlain: String(data.body_plain ?? ""),
    category,
    tags,
    legacyUrl: data.legacy_url ? String(data.legacy_url) : undefined,
    legacyId: data.legacy_id ? Number(data.legacy_id) : undefined,
    updatedAt: String(data.updated_at)
  };
}

export async function listMedia(actorEmail: string): Promise<MediaRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_media_assets")
    .select("id, asset_type, name, storage_path, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  await createAudit(actorEmail, "media.list", "media", "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    type: row.asset_type as "image" | "document" | "video-cover",
    name: String(row.name),
    url: String(row.storage_path),
    updatedAt: String(row.updated_at)
  }));
}

export async function upsertMediaRecord(
  input: Omit<MediaRecord, "updatedAt">,
  actorEmail: string
): Promise<MediaRecord> {
  const supabase = createSupabaseAdminClient();
  const id = input.id?.trim() || randomUUID();
  const payload = {
    id,
    asset_type: input.type,
    name: input.name,
    storage_path: input.url,
    metadata: {}
  };
  const { data, error } = await supabase
    .from("cms_media_assets")
    .upsert(payload, { onConflict: "id" })
    .select("id, asset_type, name, storage_path, updated_at")
    .single();
  if (error) throw error;
  await createAudit(actorEmail, "media.upsert", "media", String(data.id), "write", { name: data.name });
  return {
    id: String(data.id),
    type: data.asset_type as "image" | "document" | "video-cover",
    name: String(data.name),
    url: String(data.storage_path),
    updatedAt: String(data.updated_at)
  };
}

/**
 * True when PostgREST rejected a query because `sort_order` is not there yet.
 *
 * `009_category_sort_order.sql` has to be run by hand against the content
 * database. Until it is, the category admin keeps working without the column
 * rather than erroring, and starts ordering the moment the column appears.
 */
interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  sort_order?: number;
}

function isMissingSortOrder(error: unknown): boolean {
  const text = JSON.stringify(error ?? "");
  return text.includes("sort_order");
}

export async function listCategories(actorEmail: string): Promise<CategoryRecord[]> {
  const supabase = createSupabaseAdminClient();
  let hasSortOrder = true;
  const ordered = await supabase
    .from("cms_article_categories")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  let categoryRows = ordered.data as CategoryRow[] | null;
  let categoryError: unknown = ordered.error;
  if (categoryError && isMissingSortOrder(categoryError)) {
    hasSortOrder = false;
    const fallback = await supabase
      .from("cms_article_categories")
      .select("id, slug, name")
      .order("name", { ascending: true });
    categoryRows = fallback.data as CategoryRow[] | null;
    categoryError = fallback.error;
  }
  if (categoryError) throw categoryError;

  const ids = (categoryRows ?? []).map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: mapRows, error: mapError } = await supabase
      .from("cms_article_category_map")
      .select("category_id")
      .in("category_id", ids);
    if (mapError) throw mapError;
    for (const row of mapRows ?? []) {
      const key = String((row as any).category_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  await createAudit(actorEmail, "category.list", "category", "all", "read");
  return (categoryRows ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    articleCount: counts.get(String(row.id)) ?? 0,
    sortOrder: hasSortOrder ? Number(row.sort_order ?? 0) : 0
  }));
}

export async function upsertCategoryRecord(
  input: { id?: string; slug?: string; name: string; sortOrder?: number },
  actorEmail: string
): Promise<CategoryRecord> {
  const supabase = createSupabaseAdminClient();
  const normalizedName = input.name.trim();
  const slug = resolveCategorySlug(normalizedName, input.slug);
  const sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(Number(input.sortOrder)) : undefined;

  const payload: Record<string, unknown> = { slug, name: normalizedName };
  const withOrder = sortOrder === undefined ? payload : { ...payload, sort_order: sortOrder };

  const write = async (values: Record<string, unknown>, columns: string) =>
    input.id?.trim()
      ? supabase
          .from("cms_article_categories")
          .update(values)
          .eq("id", input.id)
          .select(columns)
          .single()
      : supabase
          .from("cms_article_categories")
          .upsert(values, { onConflict: "slug" })
          .select(columns)
          .single();

  const first = await write(withOrder, "id, slug, name, sort_order");
  let row = first.data as CategoryRow | null;
  let error: unknown = first.error;
  if (error && isMissingSortOrder(error)) {
    // Pre-migration: keep the rename working, drop the order silently.
    const retry = await write(payload, "id, slug, name");
    row = retry.data as CategoryRow | null;
    error = retry.error;
  }
  if (error) throw error;
  if (!row) throw new Error("Category write returned no row");

  await createAudit(
    actorEmail,
    input.id?.trim() ? "category.update" : "category.upsert",
    "category",
    String(row.id),
    "write",
    { slug, name: normalizedName, sortOrder }
  );
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    articleCount: 0,
    sortOrder: Number(row.sort_order ?? sortOrder ?? 0)
  };
}

export async function deleteCategoryById(id: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const { data: mappingRows, error: mappingError } = await supabase
    .from("cms_article_category_map")
    .select("article_id")
    .eq("category_id", id)
    .limit(1);
  if (mappingError) throw mappingError;
  if ((mappingRows ?? []).length > 0) {
    throw new Error("Category has linked articles; reassign or remove mappings first.");
  }

  const { error } = await supabase.from("cms_article_categories").delete().eq("id", id);
  if (error) throw error;
  await createAudit(actorEmail, "category.delete", "category", id, "write");
  return true;
}

function parsePlatformIdsJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function listVideos(actorEmail: string): Promise<VideoRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_videos")
    .select(
      "id, slug, title, description, duration_seconds, cover_asset_id, download_asset_id, platform_ids, status, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  await createAudit(actorEmail, "video.list", "video", "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description ?? ""),
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : undefined,
    coverAssetId: row.cover_asset_id ? String(row.cover_asset_id) : undefined,
    downloadAssetId: row.download_asset_id ? String(row.download_asset_id) : undefined,
    platformIdsJson: JSON.stringify(row.platform_ids ?? {}, null, 2),
    status: row.status as "draft" | "published" | "archived",
    updatedAt: String(row.updated_at)
  }));
}

export async function upsertVideoRecord(
  input: {
    id?: string;
    slug: string;
    title: string;
    description: string;
    durationSeconds?: number;
    coverAssetId?: string;
    downloadAssetId?: string;
    platformIdsJson: string;
    status: "draft" | "published" | "archived";
  },
  actorEmail: string
): Promise<VideoRecord> {
  const supabase = createSupabaseAdminClient();
  const id = input.id?.trim() || randomUUID();
  const payload = {
    id,
    slug: input.slug.trim(),
    title: input.title.trim(),
    description: input.description ?? "",
    duration_seconds: input.durationSeconds ?? null,
    cover_asset_id: input.coverAssetId?.trim() || null,
    download_asset_id: input.downloadAssetId?.trim() || null,
    platform_ids: parsePlatformIdsJson(input.platformIdsJson),
    status: input.status
  };
  const { data, error } = await supabase
    .from("cms_videos")
    .upsert(payload, { onConflict: "slug" })
    .select(
      "id, slug, title, description, duration_seconds, cover_asset_id, download_asset_id, platform_ids, status, updated_at"
    )
    .single();
  if (error) throw error;

  await createAudit(actorEmail, "video.upsert", "video", String(data.id), "write", {
    slug: data.slug,
    status: data.status
  });

  return {
    id: String(data.id),
    slug: String(data.slug),
    title: String(data.title),
    description: String(data.description ?? ""),
    durationSeconds: data.duration_seconds ? Number(data.duration_seconds) : undefined,
    coverAssetId: data.cover_asset_id ? String(data.cover_asset_id) : undefined,
    downloadAssetId: data.download_asset_id ? String(data.download_asset_id) : undefined,
    platformIdsJson: JSON.stringify(data.platform_ids ?? {}, null, 2),
    status: data.status as "draft" | "published" | "archived",
    updatedAt: String(data.updated_at)
  };
}

export async function deleteVideoById(id: string, actorEmail: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("cms_videos").delete().eq("id", id);
  if (error) throw error;
  await createAudit(actorEmail, "video.delete", "video", id, "write");
  return true;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function listSettings(actorEmail: string): Promise<SettingRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_site_settings")
    .select("id, setting_key, value_json, updated_at")
    .order("setting_key", { ascending: true });
  if (error) throw error;
  await createAudit(actorEmail, "settings.list", "settings", "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    settingKey: String(row.setting_key),
    valueJson: JSON.stringify(row.value_json ?? {}, null, 2),
    updatedAt: String(row.updated_at)
  }));
}

export async function upsertSettingRecord(
  input: { id?: string; settingKey: string; valueJson: string },
  actorEmail: string
): Promise<SettingRecord> {
  const supabase = createSupabaseAdminClient();
  const id = input.id?.trim() || randomUUID();
  const { data, error } = await supabase
    .from("cms_site_settings")
    .upsert(
      {
        id,
        setting_key: input.settingKey,
        value_json: parseJsonObject(input.valueJson)
      },
      { onConflict: "setting_key" }
    )
    .select("id, setting_key, value_json, updated_at")
    .single();
  if (error) throw error;
  await createAudit(actorEmail, "settings.upsert", "settings", String(data.id), "write", {
    settingKey: data.setting_key
  });
  return {
    id: String(data.id),
    settingKey: String(data.setting_key),
    valueJson: JSON.stringify(data.value_json ?? {}, null, 2),
    updatedAt: String(data.updated_at)
  };
}

export async function listAudits(actorEmail: string): Promise<AuditRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_audit_logs")
    .select("id, actor_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  await createAudit(actorEmail, "audit.list", "audit", "cms_audit_logs", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    actor: String(row.actor_email),
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    detail: JSON.stringify(row.detail ?? {}),
    createdAt: String(row.created_at)
  }));
}

export async function listRevisions(
  actorEmail: string,
  entityType?: "page" | "article"
): Promise<RevisionRecord[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("cms_revisions")
    .select("id, entity_type, entity_id, payload, actor_email, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (entityType) query = query.eq("entity_type", entityType);
  const { data, error } = await query;
  if (error) throw error;
  await createAudit(actorEmail, "revision.list", "revision", entityType ?? "all", "read");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    entityType: row.entity_type as "page" | "article",
    entityId: String(row.entity_id),
    payload: JSON.stringify(row.payload ?? {}),
    createdBy: String(row.actor_email),
    createdAt: String(row.created_at)
  }));
}

export async function restoreRevision(revisionId: string, actorEmail: string) {
  if (!revisionId.trim()) throw new Error("Missing revisionId");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_revisions")
    .select("id, entity_type, entity_id, payload")
    .eq("id", revisionId)
    .single();
  if (error) throw error;
  const payload = (data.payload ?? {}) as Record<string, any>;
  const record = payload.record as Record<string, any> | undefined;
  if (!record) throw new Error("Revision payload missing record");
  if (data.entity_type !== "page" && data.entity_type !== "article") {
    throw new Error("Unsupported revision entity type");
  }

  const allowedStatus = new Set<PageStatus>(["draft", "review", "published", "archived"]);
  const sanitizeStatus = (value: unknown): PageStatus => {
    const normalized = String(value ?? "draft") as PageStatus;
    if (!allowedStatus.has(normalized)) throw new Error("Invalid revision status");
    return normalized;
  };

  if (data.entity_type === "page") {
    if (!record.section || !record.slug || !record.title) {
      throw new Error("Invalid page revision payload");
    }
    const pageInput: Omit<PageRecord, "updatedAt"> = {
      id: String(record.id ?? ""),
      section: String(record.section),
      slug: String(record.slug),
      title: String(record.title),
      locale: String(record.locale ?? "zh"),
      status: sanitizeStatus(record.status),
      blocksJson: JSON.stringify(record.blocks ?? [])
    };
    await upsertPageRecord(pageInput, actorEmail);
  } else {
    if (!record.slug || !record.title) {
      throw new Error("Invalid article revision payload");
    }
    const taxonomy = (payload.taxonomy ?? {}) as { category?: string; tags?: string[] };
    const articleInput: Omit<ArticleRecord, "updatedAt"> = {
      id: String(record.id ?? ""),
      slug: String(record.slug),
      title: String(record.title),
      section: String(record.section ?? "news"),
      locale: String(record.locale ?? "zh"),
      status: sanitizeStatus(record.status),
      bodyMarkdown: String(record.body_markdown ?? ""),
      bodyPlain: String(record.body_plain ?? ""),
      category: taxonomy.category ?? "news",
      tags: Array.isArray(taxonomy.tags) ? taxonomy.tags : [],
      legacyUrl: record.legacy_url ? String(record.legacy_url) : undefined,
      legacyId: record.legacy_id ? Number(record.legacy_id) : undefined
    };
    await upsertArticleRecord(articleInput, actorEmail);
  }

  await createAudit(actorEmail, "revision.restore", "revision", revisionId, "write", {
    entityType: data.entity_type,
    entityId: data.entity_id
  });
}
