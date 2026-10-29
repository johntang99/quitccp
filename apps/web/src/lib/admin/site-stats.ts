import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SITE_LOCALE } from "@/lib/site-config";
import { STATS_DATASET } from "@/lib/site-stats";
import { analyticsConfigured, analyticsQuery, normalisePath, statsWhere } from "@/lib/admin/site-stats-rollup";

/**
 * What /admin/stats and the article list read. History comes from the
 * `cms_stats_*` rollups; only "today so far" asks Analytics Engine directly,
 * because today has not been rolled up yet.
 */

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The last `days` complete UTC days, ending yesterday. */
export function statsRange(days: number) {
  const to = iso(Date.now() - DAY);
  const from = iso(Date.now() - days * DAY);
  return { from, to };
}

export type DailyRow = { day: string; views: number; visitors: number; entrances: number; new_visitors: number };

export async function dailySeries(from: string, to: string): Promise<DailyRow[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("cms_stats_daily")
    .select("day, views, visitors, entrances, new_visitors")
    .eq("locale", SITE_LOCALE)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyRow[];
}

export type Ranked = { value: string; views: number; visitors: number };

export async function dimension(dim: string, from: string, to: string, limit = 30): Promise<Ranked[]> {
  const { data, error } = await createSupabaseAdminClient().rpc("cms_stats_dim", {
    p_locale: SITE_LOCALE,
    p_from: from,
    p_to: to,
    p_dim: dim,
    p_limit: limit
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Ranked[]).map((r) => ({ value: r.value, views: Number(r.views), visitors: Number(r.visitors) }));
}

export type ArticleRank = { id: string; title: string; slug: string; views: number; visitors: number };

export async function topArticles(from: string, to: string, limit = 30): Promise<ArticleRank[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cms_stats_top_articles", { p_locale: SITE_LOCALE, p_from: from, p_to: to, p_limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { article_id: string; views: number; visitors: number }[];
  if (rows.length === 0) return [];
  const { data: articles } = await supabase.from("cms_articles").select("id, title, slug").in("id", rows.map((r) => r.article_id));
  const byId = new Map((articles ?? []).map((a) => [String(a.id), a]));
  return rows.map((r) => ({
    id: r.article_id,
    title: String(byId.get(r.article_id)?.title ?? r.article_id),
    slug: String(byId.get(r.article_id)?.slug ?? ""),
    views: Number(r.views),
    visitors: Number(r.visitors)
  }));
}

export type PageRank = { path: string; kind: string; views: number; visitors: number };

export async function topPages(from: string, to: string, limit = 20): Promise<PageRank[]> {
  const { data, error } = await createSupabaseAdminClient().rpc("cms_stats_top_pages", { p_locale: SITE_LOCALE, p_from: from, p_to: to, p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PageRank[]).map((r) => ({ ...r, views: Number(r.views), visitors: Number(r.visitors) }));
}

/** For the article list's 7-day column: one call per page of articles. */
export async function articleViews(ids: string[], days = 7): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { from, to } = statsRange(days);
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("cms_stats_article_views", { p_locale: SITE_LOCALE, p_from: from, p_to: to, p_ids: ids });
    if (error) return new Map();
    return new Map(((data ?? []) as { article_id: string; views: number }[]).map((r) => [r.article_id, Number(r.views)]));
  } catch {
    /* A column of numbers is not worth failing the article list over. */
    return new Map();
  }
}

export async function articleSeries(id: string, from: string, to: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("cms_stats_daily_pages")
    .select("day, views, visitors")
    .eq("locale", SITE_LOCALE)
    .eq("article_id", id)
    .gte("day", from)
    .lte("day", to);
  if (error) throw new Error(error.message);
  const byDay = new Map<string, { views: number; visitors: number }>();
  for (const row of data ?? []) {
    const cur = byDay.get(String(row.day)) ?? { views: 0, visitors: 0 };
    cur.views += Number(row.views);
    cur.visitors += Number(row.visitors);
    byDay.set(String(row.day), cur);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
}

export async function articleDimension(id: string, dim: string, from: string, to: string): Promise<{ value: string; views: number }[]> {
  const { data, error } = await createSupabaseAdminClient().rpc("cms_stats_article_dim", {
    p_locale: SITE_LOCALE,
    p_from: from,
    p_to: to,
    p_article: id,
    p_dim: dim
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { value: string; views: number }[]).map((r) => ({ value: r.value, views: Number(r.views) }));
}

export type LiveToday = { views: number; visitors: number; top: { path: string; views: number }[] } | null;

/** Today (UTC) so far, straight from Analytics Engine. Null when it cannot be asked. */
export async function liveToday(): Promise<LiveToday> {
  if (!analyticsConfigured()) return null;
  const where = statsWhere(iso(Date.now()));
  try {
    const [totals, top] = await Promise.all([
      analyticsQuery(`SELECT SUM(_sample_interval) AS views, COUNT(DISTINCT blob11) AS visitors FROM ${STATS_DATASET} WHERE ${where}`),
      analyticsQuery(`SELECT blob2 AS path, SUM(_sample_interval) AS views FROM ${STATS_DATASET} WHERE ${where} GROUP BY path ORDER BY views DESC LIMIT 10`)
    ]);
    return {
      views: Number(totals[0]?.views ?? 0),
      visitors: Number(totals[0]?.visitors ?? 0),
      top: top.map((r) => ({ path: normalisePath(r.path), views: Number(r.views) }))
    };
  } catch {
    return null;
  }
}
