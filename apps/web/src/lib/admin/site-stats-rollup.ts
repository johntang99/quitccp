import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SITE_LOCALE } from "@/lib/site-config";
import { STATS_DATASET } from "@/lib/site-stats";
import { classifySource } from "@/lib/admin/stats-sources";

/**
 * Rolls one UTC day of page views out of Workers Analytics Engine and into the
 * `cms_stats_*` tables (migration 045).
 *
 * Analytics Engine keeps three months; these tables keep everything. Running a
 * day again recomputes it from whatever Analytics Engine holds and replaces the
 * rows, so a late or repeated run is harmless -- and a missed one can be
 * backfilled by hand for as long as the three months last.
 *
 * Counts use `SUM(_sample_interval)`, not `COUNT()`: Analytics Engine samples a
 * busy index, and each surviving row says how many it stands for.
 */

type Row = Record<string, string>;

export function analyticsConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && analyticsToken());
}

/* A read-only token on Vercel; the deploy token is accepted locally so a
   backfill can be run from a laptop without minting another. */
function analyticsToken() {
  return process.env.CLOUDFLARE_ANALYTICS_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
}

export async function analyticsQuery(sql: string): Promise<Row[]> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = analyticsToken();
  if (!account || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_ANALYTICS_TOKEN 未配置");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: `${sql} FORMAT JSON`,
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Analytics Engine ${response.status}: ${text.slice(0, 200)}`);
  return (JSON.parse(text) as { data: Row[] }).data;
}

/** Only ever a date we formatted ourselves, but it goes into SQL text. */
function dayRange(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`bad day: ${day}`);
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return `timestamp >= toDateTime('${day} 00:00:00') AND timestamp < toDateTime('${next} 00:00:00')`;
}

/** Same site, the given day, minus our own test hits (`/__…`). */
export function statsWhere(day: string, extra = "") {
  return `blob1 = '${SITE_LOCALE}' AND ${dayRange(day)} AND NOT startsWith(blob2, '/__')${extra ? ` AND ${extra}` : ""}`;
}

const n = (v: string | undefined) => Number(v ?? 0) || 0;

/**
 * The browser may hand us the path percent-encoded or not, depending on how the
 * reader arrived. Decoded, so both spellings land on one row.
 */
export function normalisePath(raw: string) {
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {}
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

/** Our own hosts: a hit referred by one of these is a reader moving around the site. */
const OWN_HOSTS = new Set(["www.tuidang.org", "tuidang.org"]);

function isEntrance(host: string, nav: string) {
  return nav !== "nav" && !OWN_HOSTS.has(host);
}

type ArticleRef = { id: string };

/**
 * /news/<slug> and /a/<code> to article ids. Asked of the database once per
 * run, in chunks -- a day has a few thousand distinct paths at most.
 */
async function resolveArticles(paths: string[]) {
  const supabase = createSupabaseAdminClient();
  const bySlug = new Map<string, ArticleRef>();
  const byCode = new Map<string, ArticleRef>();
  const slugs = new Set<string>();
  const codes = new Set<string>();
  for (const path of paths) {
    const news = /^\/news\/([^/]+)$/.exec(path);
    if (news) slugs.add(news[1]);
    const short = /^\/a\/([^/]+)$/.exec(path);
    if (short) codes.add(short[1]);
  }
  const chunk = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / 150) }, (_, i) => items.slice(i * 150, i * 150 + 150));
  for (const part of chunk([...slugs])) {
    const { data, error } = await supabase.from("cms_articles").select("id, slug").eq("locale", SITE_LOCALE).in("slug", part);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) bySlug.set(String(row.slug), { id: String(row.id) });
  }
  for (const part of chunk([...codes])) {
    const { data, error } = await supabase.from("cms_articles").select("id, short_code").eq("locale", SITE_LOCALE).in("short_code", part);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byCode.set(String(row.short_code), { id: String(row.id) });
  }
  return (path: string): string | null => {
    const news = /^\/news\/([^/]+)$/.exec(path);
    if (news) return bySlug.get(news[1])?.id ?? null;
    const short = /^\/a\/([^/]+)$/.exec(path);
    if (short) return byCode.get(short[1])?.id ?? null;
    return null;
  };
}

function pageKind(path: string, articleId: string | null) {
  if (articleId) return "article";
  if (path === "/") return "home";
  if (path === "/news" || path.startsWith("/news/")) return "news-listing";
  if (path.startsWith("/videos") || path.startsWith("/v/")) return "video";
  if (path.startsWith("/materials")) return "material";
  return "page";
}

/** Two-letter language plus region when there is one: zh-cn, zh-tw, en. */
function normaliseLang(raw: string) {
  const parts = raw.toLowerCase().split(/[-_]/);
  if (!parts[0]) return "unknown";
  /* zh-Hant-TW and zh-TW are the same reader; keep the region, drop the script. */
  const region = parts.slice(1).find((p) => p.length === 2);
  return region ? `${parts[0]}-${region}` : parts[0];
}

type Agg = { views: number; visitors: number };
function bump(map: Map<string, Agg>, key: string, views: number, visitors: number) {
  const cur = map.get(key) ?? { views: 0, visitors: 0 };
  cur.views += views;
  cur.visitors += visitors;
  map.set(key, cur);
}

export type StatsRollupResult = { day: string; views: number; visitors: number; pages: number; articles: number };

export async function rollupStatsDay(day: string): Promise<StatsRollupResult> {
  const where = statsWhere(day);
  const views = "SUM(_sample_interval) AS views";
  const visitors = "COUNT(DISTINCT blob11) AS visitors";
  const articlePaths = "(startsWith(blob2, '/news/') OR startsWith(blob2, '/a/'))";

  const [totals, newVisitors, pages, sources, geo, devices, langs, articleSources, articleGeo] = await Promise.all([
    analyticsQuery(`SELECT ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where}`),
    analyticsQuery(`SELECT blob12 AS first, ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where} GROUP BY first`),
    analyticsQuery(`SELECT blob2 AS path, ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where} GROUP BY path LIMIT 50000`),
    analyticsQuery(
      `SELECT blob3 AS host, blob4 AS nav, blob5 AS utm, ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where} GROUP BY host, nav, utm LIMIT 20000`
    ),
    analyticsQuery(
      `SELECT blob6 AS country, blob7 AS region, blob8 AS city, ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where} GROUP BY country, region, city LIMIT 20000`
    ),
    analyticsQuery(`SELECT blob9 AS device, ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where} GROUP BY device`),
    analyticsQuery(`SELECT blob10 AS lang, ${views}, ${visitors} FROM ${STATS_DATASET} WHERE ${where} GROUP BY lang LIMIT 2000`),
    analyticsQuery(
      `SELECT blob2 AS path, blob3 AS host, blob4 AS nav, blob5 AS utm, ${views} FROM ${STATS_DATASET} WHERE ${statsWhere(day, articlePaths)} GROUP BY path, host, nav, utm LIMIT 100000`
    ),
    analyticsQuery(
      `SELECT blob2 AS path, blob6 AS country, ${views} FROM ${STATS_DATASET} WHERE ${statsWhere(day, articlePaths)} GROUP BY path, country LIMIT 100000`
    )
  ]);

  /* Pages, merged on the decoded path. */
  const pageAgg = new Map<string, Agg>();
  for (const row of pages) bump(pageAgg, normalisePath(row.path), n(row.views), n(row.visitors));
  const articleOf = await resolveArticles([...pageAgg.keys()]);

  /* Dimensions. Visitors are summed across the finer groups beneath each
     value; a reader is almost always in one country, one city, one source a
     day, so the overcount is small -- and the views are exact. */
  const dims = new Map<string, Map<string, Agg>>();
  const dim = (name: string) => dims.get(name) ?? dims.set(name, new Map()).get(name)!;
  let entrances = 0;
  for (const row of sources) {
    if (!isEntrance(row.host, row.nav)) continue;
    const v = n(row.views);
    const u = n(row.visitors);
    entrances += v;
    bump(dim("source_type"), classifySource(row.host, row.utm), v, u);
    bump(dim("source_host"), row.host || "(direct)", v, u);
    if (row.utm) bump(dim("utm"), row.utm, v, u);
  }
  for (const row of geo) {
    const v = n(row.views);
    const u = n(row.visitors);
    const country = row.country || "XX";
    bump(dim("country"), country, v, u);
    if (row.region) bump(dim("region"), `${country}|${row.region}`, v, u);
    if (row.city) bump(dim("city"), `${country}|${row.region}|${row.city}`, v, u);
  }
  for (const row of devices) bump(dim("device"), row.device || "unknown", n(row.views), n(row.visitors));
  for (const row of langs) bump(dim("lang"), normaliseLang(row.lang), n(row.views), n(row.visitors));

  /* Per-article source type and country. */
  const articleDims = new Map<string, number>();
  const addArticleDim = (path: string, name: string, value: string, v: number) => {
    const id = articleOf(normalisePath(path));
    if (!id) return;
    const key = `${id}\u0000${name}\u0000${value}`;
    articleDims.set(key, (articleDims.get(key) ?? 0) + v);
  };
  for (const row of articleSources) {
    const type = isEntrance(row.host, row.nav) ? classifySource(row.host, row.utm) : "internal";
    addArticleDim(row.path, "source_type", type, n(row.views));
  }
  for (const row of articleGeo) addArticleDim(row.path, "country", row.country || "XX", n(row.views));

  const total = totals[0] ?? {};
  /* A new reader's first page carries the flag and the rest do not, so this is
     a count of readers, not of views; returning = visitors - new. */
  const newCount = newVisitors.find((r) => r.first === "1");
  const locale = SITE_LOCALE;
  const pageRows = [...pageAgg.entries()].map(([path, agg]) => {
    const articleId = articleOf(path);
    return { day, locale, path, kind: pageKind(path, articleId), article_id: articleId, views: agg.views, visitors: agg.visitors };
  });
  const dimRows = [...dims.entries()].flatMap(([name, values]) =>
    [...values.entries()].map(([value, agg]) => ({ day, locale, dim: name, value: value.slice(0, 300), views: agg.views, visitors: agg.visitors }))
  );
  const articleDimRows = [...articleDims.entries()].map(([key, v]) => {
    const [article_id, name, value] = key.split("\u0000");
    return { day, locale, article_id, dim: name, value, views: v };
  });

  const supabase = createSupabaseAdminClient();
  /* Replace the day wholesale: a path or a city that vanished on recompute
     must not survive from the previous run. */
  for (const table of ["cms_stats_daily_pages", "cms_stats_daily_dims", "cms_stats_daily_article_dims"]) {
    const { error } = await supabase.from(table).delete().eq("day", day).eq("locale", locale);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  const insert = async (table: string, rows: object[]) => {
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + 1000));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await insert("cms_stats_daily_pages", pageRows);
  await insert("cms_stats_daily_dims", dimRows);
  await insert("cms_stats_daily_article_dims", articleDimRows);
  const { error } = await supabase.from("cms_stats_daily").upsert({
    day,
    locale,
    views: n(total.views),
    visitors: n(total.visitors),
    entrances,
    new_visitors: n(newCount?.visitors),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`cms_stats_daily: ${error.message}`);

  return {
    day,
    views: n(total.views),
    visitors: n(total.visitors),
    pages: pageRows.length,
    articles: new Set(pageRows.map((r) => r.article_id).filter(Boolean)).size
  };
}
