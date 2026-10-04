import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { searchEverythingBySubstring, type SearchResultType } from "@/lib/search-substring";

export interface SearchArticleResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  section: string;
  score: number;
  /** Which content type this is. Only the substring backend fills it in; the
   *  article-only backends are always "article". */
  type: SearchResultType;
  /** Where the result goes. Articles, videos and materials have different URL
   *  shapes, so the backend decides rather than the page guessing. */
  href: string;
  typeLabel: string;
  /** Shown on the result card, and what the 最新 sort orders by. Null for
   *  anything unpublished or undated. */
  publishedAt: string | null;
  /**
   * Thumbnail for the result card, or null for none.
   *
   * Only the substring backend -- the one that actually serves the site -- fills
   * this in. The others leave it null and the card simply has no picture, which
   * is the same thing that happens for the many rows that have no image anyway.
   */
  image?: string | null;
}

export type SearchBackend = "pg_trgm" | "meilisearch" | "substring" | "fallback_ilike";

export interface SearchExecutionMeta {
  primaryBackend: SearchBackend;
  effectiveBackend: SearchBackend;
  dualReadEnabled: boolean;
  /** A scan was cut short by its time budget, so results may be incomplete. */
  truncated: boolean;
}

interface SearchRpcRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  score: number;
}

interface FallbackSearchRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  section: string;
}

interface MeiliHit {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  section?: string;
  /** Written by lib/search-index; absent on documents from the old shape. */
  type?: SearchResultType;
  href?: string;
  published_at?: string | null;
  _rankingScore?: number;
}

interface MeiliSearchResponse {
  hits?: MeiliHit[];
}

function envFlag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function getConfiguredPrimaryBackend(): SearchBackend {
  const raw = (process.env.SEARCH_PRIMARY_BACKEND ?? "substring").trim().toLowerCase();
  if (raw === "meilisearch") return "meilisearch";
  if (raw === "pg_trgm") return "pg_trgm";
  if (raw === "substring") return "substring";
  // Unrecognised values used to fall through to pg_trgm, which is the one
  // backend that cannot answer a Chinese query. Substring always answers.
  return "substring";
}

function getMeiliConfig() {
  const host = process.env.MEILI_HOST?.trim();
  // Search-only key first. Both variables exist in the same deployment -- the
  // sync job needs the master key -- so preferring the master key here meant
  // every public search ran with credentials that can also delete the index.
  const apiKey = process.env.MEILI_SEARCH_API_KEY?.trim() || process.env.MEILI_MASTER_KEY?.trim() || "";
  const index = process.env.MEILI_INDEX_ARTICLES?.trim() || "articles";
  return {
    host,
    apiKey,
    index
  };
}

const MEILI_TYPE_LABEL: Record<SearchResultType, string> = {
  article: "新闻与报告",
  video: "视频",
  material: "资料"
};

function toSearchRowsFromMeili(hits: MeiliHit[]): SearchArticleResult[] {
  return hits.map((hit) => {
    // Documents indexed before the multi-type shape carry neither field; they
    // are articles, and fall back to the article URL rather than vanishing.
    const type: SearchResultType = hit.type ?? "article";
    const href = hit.href ?? `/news/${encodeURIComponent(String(hit.slug))}`;
    return {
      id: String(hit.id),
      slug: String(hit.slug),
      title: String(hit.title),
      excerpt: String(hit.summary ?? ""),
      section: type === "article" ? "news" : type,
      score: Number(hit._rankingScore ?? 0),
      type,
      href,
      typeLabel: MEILI_TYPE_LABEL[type],
      publishedAt: hit.published_at ?? null
    };
  });
}

async function searchWithPgTrgm(
  query: string,
  locale: string,
  limit: number,
  offset: number
): Promise<SearchArticleResult[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("search_articles_trgm", {
    p_query: query,
    p_locale: locale,
    p_limit: limit,
    p_offset: offset
  });
  if (error) throw error;

  const rows = (data ?? []) as SearchRpcRow[];
  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.summary ?? ""),
    section: "news",
    score: Number(row.score ?? 0),
    type: "article" as SearchResultType,
    href: `/news/${encodeURIComponent(String(row.slug))}`,
    typeLabel: "新闻与报告",
    publishedAt: null
  }));
}

async function searchWithMeilisearch(
  query: string,
  locale: string,
  limit: number,
  offset: number
): Promise<SearchArticleResult[]> {
  const config = getMeiliConfig();
  if (!config.host) {
    throw new Error("MEILI_HOST is not set");
  }

  const url = `${config.host.replace(/\/$/, "")}/indexes/${encodeURIComponent(config.index)}/search`;
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      q: query,
      limit,
      offset,
      filter: [`locale = "${locale}"`, `status = "published"`],
      attributesToRetrieve: [
        "id", "slug", "title", "summary", "section", "type", "href", "published_at"
      ],
      showRankingScore: true
    })
  });
  if (!response.ok) {
    throw new Error(`Meilisearch failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as MeiliSearchResponse;
  return toSearchRowsFromMeili(payload.hits ?? []);
}

async function searchWithIlikeFallback(
  query: string,
  locale: string,
  limit: number,
  offset: number
): Promise<SearchArticleResult[]> {
  const supabase = createSupabaseAdminClient();
  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("cms_articles")
    .select("id, slug, title, summary, section")
    .eq("locale", locale)
    .eq("status", "published")
    .ilike("title", `%${query}%`)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (fallbackError) throw fallbackError;

  return ((fallbackRows ?? []) as FallbackSearchRow[]).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.summary ?? ""),
    section: String(row.section ?? "news"),
    score: 0,
    type: "article" as SearchResultType,
    href: `/news/${encodeURIComponent(String(row.slug))}`,
    typeLabel: "新闻与报告",
    publishedAt: null
  }));
}

async function searchWithBackend(
  backend: SearchBackend,
  query: string,
  locale: string,
  limit: number,
  offset: number,
  // Carried in a caller-owned box rather than module state: several searches run
  // at once in one process, and a shared flag would attribute one request's
  // timeout to another's results.
  truncatedOut: { value: boolean } = { value: false }
): Promise<SearchArticleResult[]> {
  if (backend === "meilisearch") {
    return searchWithMeilisearch(query, locale, limit, offset);
  }
  if (backend === "pg_trgm") {
    return searchWithPgTrgm(query, locale, limit, offset);
  }
  if (backend === "substring") {
    const outcome = await searchEverythingBySubstring(query, { locale, limit });
    truncatedOut.value = truncatedOut.value || outcome.truncated;
    return outcome.results.map((row) => ({
      id: row.id,
      // The slug is no longer how a result is addressed -- href is -- but the
      // field stays because callers and the JSON API still read it.
      slug: row.href.split("/").pop() ?? "",
      title: row.title,
      excerpt: row.excerpt,
      section: row.type === "article" ? "news" : row.type,
      score: row.score,
      type: row.type,
      href: row.href,
      typeLabel: row.typeLabel,
      publishedAt: row.publishedAt,
      image: row.image
    }));
  }
  return searchWithIlikeFallback(query, locale, limit, offset);
}

function logDualReadDiff(
  query: string,
  primary: SearchBackend,
  secondary: SearchBackend,
  primaryRows: SearchArticleResult[],
  secondaryRows: SearchArticleResult[]
) {
  const primaryTop = primaryRows.slice(0, 5).map((row) => row.id);
  const secondaryTop = secondaryRows.slice(0, 5).map((row) => row.id);
  // eslint-disable-next-line no-console
  console.info(
    `[search-dual-read] q="${query}" primary=${primary} secondary=${secondary} primaryTop=${primaryTop.join(",")} secondaryTop=${secondaryTop.join(",")}`
  );
}

export async function searchPublishedArticlesWithMeta(
  query: string,
  options: { locale?: string; limit?: number; offset?: number } = {}
): Promise<{ results: SearchArticleResult[]; meta: SearchExecutionMeta }> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      results: [],
      meta: {
        primaryBackend: getConfiguredPrimaryBackend(),
        effectiveBackend: getConfiguredPrimaryBackend(),
        dualReadEnabled: envFlag("SEARCH_DUAL_READ", false),
        truncated: false
      }
    };
  }

  const locale = options.locale ?? "zh";
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const primaryBackend = getConfiguredPrimaryBackend();
  const dualReadEnabled = envFlag("SEARCH_DUAL_READ", false);

  let effectiveBackend: SearchBackend = primaryBackend;
  let results: SearchArticleResult[];
  const truncatedOut = { value: false };

  try {
    results = await searchWithBackend(primaryBackend, normalizedQuery, locale, limit, offset, truncatedOut);
  } catch (primaryError) {
    // Substring is the floor: it needs no index, no extension and no running
    // service, so it answers whenever the database is reachable at all. The old
    // chain fell back to pg_trgm, which is precisely the backend that returns
    // nothing for Chinese -- a fallback that fails quietly is worse than none.
    const secondaryBackend: SearchBackend =
      primaryBackend === "substring" ? "fallback_ilike" : "substring";
    try {
      results = await searchWithBackend(secondaryBackend, normalizedQuery, locale, limit, offset, truncatedOut);
      effectiveBackend = secondaryBackend;
    } catch {
      results = await searchWithBackend("fallback_ilike", normalizedQuery, locale, limit, offset, truncatedOut);
      effectiveBackend = "fallback_ilike";
    }

    // eslint-disable-next-line no-console
    console.warn(`[search-primary-failed] backend=${primaryBackend} query="${normalizedQuery}"`, primaryError);
  }

  if (dualReadEnabled && effectiveBackend !== "fallback_ilike") {
    const secondary: SearchBackend =
      effectiveBackend === "meilisearch" ? "substring" : "meilisearch";
    void searchWithBackend(secondary, normalizedQuery, locale, limit, offset)
      .then((secondaryRows) => {
        logDualReadDiff(normalizedQuery, effectiveBackend, secondary, results, secondaryRows);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn(`[search-dual-read-secondary-failed] backend=${secondary} query="${normalizedQuery}"`, error);
      });
  }

  return {
    results,
    meta: {
      primaryBackend,
      effectiveBackend,
      dualReadEnabled,
      truncated: truncatedOut.value
    }
  };
}

export async function searchPublishedArticles(
  query: string,
  options: { locale?: string; limit?: number; offset?: number } = {}
): Promise<SearchArticleResult[]> {
  const execution = await searchPublishedArticlesWithMeta(query, options);
  return execution.results;
}
