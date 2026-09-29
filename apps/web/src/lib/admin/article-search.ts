import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import type { ArticleRecord } from "@/lib/admin/types";

/**
 * Search and filtering for the article admin.
 *
 * Separate from `listArticles`, which carries cursor pagination for the API.
 * This one is built for the screen: offset paging so the operator can jump
 * pages, and the filters that actually matter with 15,000 rows -- including the
 * data-quality gaps left by the migration.
 */

export type ArticleGap = "no-cover" | "no-author" | "no-summary" | "unfiled";
export type ArticleSort = "updated" | "published" | "title";

export interface ArticleSearchFilters {
  q?: string;
  /** Category slug. */
  category?: string;
  status?: string;
  author?: string;
  /** Published on or after / before, as YYYY-MM-DD. */
  from?: string;
  to?: string;
  gap?: ArticleGap;
  sort?: ArticleSort;
  page?: number;
  pageSize?: number;
}

const SELECT =
  "id, slug, title, subtitle, section, locale, status, summary, hero_image, author, published_at, updated_at, legacy_id";

export interface ArticleSearchResult {
  rows: ArticleRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function searchArticles(filters: ArticleSearchFilters): Promise<ArticleSearchResult> {
  const supabase = createSupabaseAdminClient();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  // The category filter joins through the map table with an inner join, so the
  // database does the narrowing. Fetching the matching article ids first would
  // hit PostgREST's 1000-row response cap -- 红朝败相 alone holds 8,631.
  let query = filters.category
    ? supabase
        .from("cms_articles")
        .select(`${SELECT}, cms_article_category_map!inner(category_id, cms_article_categories!inner(slug))`, {
          count: "exact"
        })
        .eq("cms_article_category_map.cms_article_categories.slug", filters.category)
    : supabase.from("cms_articles").select(SELECT, { count: "exact" });

  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%,()]/g, " ");
    query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%,slug.ilike.%${term}%`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.author) query = query.eq("author", filters.author);
  if (filters.from) query = query.gte("published_at", `${filters.from}T00:00:00Z`);
  if (filters.to) query = query.lte("published_at", `${filters.to}T23:59:59Z`);

  switch (filters.gap) {
    case "no-cover":
      query = query.eq("hero_image", "");
      break;
    case "no-author":
      query = query.eq("author", "");
      break;
    case "no-summary":
      query = query.eq("summary", "");
      break;
    default:
      break;
  }

  const order =
    filters.sort === "published"
      ? { column: "published_at", ascending: false }
      : filters.sort === "title"
        ? { column: "title", ascending: true }
        : { column: "updated_at", ascending: false };

  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: false })
    .range(offset, offset + pageSize - 1);
  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = rows.map((row) => String(row.id));
  const categoryByArticle = new Map<string, string>();
  if (ids.length > 0) {
    const { data: catRows } = await supabase
      .from("cms_article_category_map")
      .select("article_id, position, cms_article_categories(name)")
      .in("article_id", ids)
      .order("position", { ascending: true });
    for (const row of catRows ?? []) {
      const articleId = String((row as { article_id: string }).article_id);
      if (categoryByArticle.has(articleId)) continue;
      const name = (row as { cms_article_categories?: { name?: string } }).cms_article_categories?.name;
      if (name) categoryByArticle.set(articleId, String(name));
    }
  }

  const total = count ?? 0;
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    rows: rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      subtitle: String(row.subtitle ?? ""),
      section: String(row.section),
      locale: String(row.locale),
      status: row.status as ArticleRecord["status"],
      bodyMarkdown: "",
      bodyPlain: "",
      summary: String(row.summary ?? ""),
      category: categoryByArticle.get(String(row.id)) ?? "",
      secondaryCategories: [],
      tags: [],
      heroImage: String(row.hero_image ?? ""),
      heroImageAlt: "",
      heroCredit: "",
      author: String(row.author ?? ""),
      translator: "",
      sourceTitle: "",
      sourceUrl: "",
      publishedAt: row.published_at ? String(row.published_at) : null,
      legacyId: row.legacy_id ? Number(row.legacy_id) : undefined,
      updatedAt: String(row.updated_at)
    }))
  };
}

/** Distinct bylines in use, for the author filter. */
export async function listArticleAuthors(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("cms_articles")
    .select("author")
    .neq("author", "")
    .limit(1000);
  return Array.from(new Set((data ?? []).map((row) => String(row.author)))).sort();
}
