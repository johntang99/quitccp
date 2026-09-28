import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export interface SearchArticleResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  section: string;
  score: number;
}

export type SearchBackend = "pg_trgm" | "meilisearch" | "fallback_ilike";

export interface SearchExecutionMeta {
  primaryBackend: SearchBackend;
  effectiveBackend: SearchBackend;
  dualReadEnabled: boolean;
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
  const raw = (process.env.SEARCH_PRIMARY_BACKEND ?? "pg_trgm").trim().toLowerCase();
  if (raw === "meilisearch") return "meilisearch";
  if (raw === "pg_trgm") return "pg_trgm";
  return "pg_trgm";
}

function getMeiliConfig() {
  const host = process.env.MEILI_HOST?.trim();
  const apiKey = process.env.MEILI_MASTER_KEY?.trim() || process.env.MEILI_SEARCH_API_KEY?.trim() || "";
  const index = process.env.MEILI_INDEX_ARTICLES?.trim() || "articles";
  return {
    host,
    apiKey,
    index
  };
}

function toSearchRowsFromMeili(hits: MeiliHit[]): SearchArticleResult[] {
  return hits.map((hit) => ({
    id: String(hit.id),
    slug: String(hit.slug),
    title: String(hit.title),
    excerpt: String(hit.summary ?? ""),
    section: String(hit.section ?? "news"),
    score: Number(hit._rankingScore ?? 0)
  }));
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
    score: Number(row.score ?? 0)
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
      attributesToRetrieve: ["id", "slug", "title", "summary", "section"],
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
    score: 0
  }));
}

async function searchWithBackend(
  backend: SearchBackend,
  query: string,
  locale: string,
  limit: number,
  offset: number
): Promise<SearchArticleResult[]> {
  if (backend === "meilisearch") {
    return searchWithMeilisearch(query, locale, limit, offset);
  }
  if (backend === "pg_trgm") {
    return searchWithPgTrgm(query, locale, limit, offset);
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
        dualReadEnabled: envFlag("SEARCH_DUAL_READ", false)
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

  try {
    results = await searchWithBackend(primaryBackend, normalizedQuery, locale, limit, offset);
  } catch (primaryError) {
    const secondaryBackend: SearchBackend = primaryBackend === "pg_trgm" ? "meilisearch" : "pg_trgm";
    try {
      results = await searchWithBackend(secondaryBackend, normalizedQuery, locale, limit, offset);
      effectiveBackend = secondaryBackend;
    } catch {
      results = await searchWithBackend("fallback_ilike", normalizedQuery, locale, limit, offset);
      effectiveBackend = "fallback_ilike";
    }

    // eslint-disable-next-line no-console
    console.warn(`[search-primary-failed] backend=${primaryBackend} query="${normalizedQuery}"`, primaryError);
  }

  if (dualReadEnabled && effectiveBackend !== "fallback_ilike") {
    const secondary: SearchBackend = effectiveBackend === "pg_trgm" ? "meilisearch" : "pg_trgm";
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
      dualReadEnabled
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
