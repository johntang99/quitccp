import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Every page a search engine should know about.
 *
 * This listed nine hand-written routes. The archive behind them -- 15,526
 * published articles, 691 videos, 46 FAQ answers -- was absent, so the only way
 * in was for a crawler to walk the section indexes link by link. Right after a
 * domain move that matters more than usual: the old URLs' standing does not
 * transfer on its own, and nothing was telling Google what the new site holds.
 *
 * The URL of each record is its canonical one, which is the slug form
 * (`/news/<slug>`), not the id fallback (`/news/a/<id>`) -- listing both would
 * offer the same article twice under two addresses, which is the duplicate
 * problem a sitemap is supposed to prevent.
 *
 * Regenerated daily rather than per request: it is ~16,000 entries and several
 * megabytes, and an article published today being listed tomorrow costs
 * nothing, while rebuilding it for every crawler hit would cost a great deal.
 */
export const revalidate = 86400;

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tuidang.org").replace(/\/$/, "");

/** Section indexes and the standing pages, which have no row to read. */
const STATIC_ROUTES = [
  "/",
  "/about",
  "/news",
  "/videos",
  "/services",
  "/services/faq",
  "/involve",
  "/resources",
  "/search",
  "/terms",
  "/legal/terms",
  "/legal/privacy"
];

/**
 * Read a whole table, not the first page of it.
 *
 * PostgREST caps a response at 1,000 rows and says so only in a header, so a
 * plain select looks like it succeeded and quietly returns 1,000 of 15,527.
 * That is exactly how this sitemap would have ended up listing a sixteenth of
 * the archive while appearing to work.
 */
type Query = ReturnType<ReturnType<typeof createSupabaseAdminClient>["from"]>["select"];

async function readAll(
  table: string,
  columns: string,
  /* Narrows the select -- `q => q.eq("status", "published")` for the tables
     that have a status, `q => q` for the ones that do not. */
  refine: (query: ReturnType<Query>) => ReturnType<Query>
): Promise<Array<Record<string, unknown>>> {
  const supabase = createSupabaseAdminClient();
  const out: Array<Record<string, unknown>> = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await refine(supabase.from(table).select(columns)).range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** `lastModified` wants a Date; a missing or unparseable timestamp is simply omitted. */
function when(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function entry(
  path: string,
  lastModified: Date | undefined,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
): MetadataRoute.Sitemap[number] {
  /* The slugs are Chinese and sit in the path unencoded in the database.
     `encodeURI` escapes them while leaving the separators alone; encoding the
     whole thing would turn every "/" into %2F. */
  return { url: encodeURI(`${SITE_ORIGIN}${path}`), lastModified, changeFrequency, priority };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) =>
    entry(route, now, route === "/" ? 1 : 0.8, route === "/" ? "weekly" : "daily")
  );

  try {
    const [articles, videos, faqs, articleCategories, videoCategories, faqCategories] = await Promise.all([
      readAll("cms_articles", "slug, updated_at, published_at", (q) => q.eq("status", "published")),
      readAll("cms_videos", "slug, updated_at", (q) => q.eq("status", "published")),
      readAll("cms_faqs", "slug, updated_at", (q) => q.eq("status", "published")),
      readAll("cms_article_categories", "slug", (q) => q),
      readAll("cms_video_categories", "slug", (q) => q),
      readAll("cms_faq_categories", "slug", (q) => q)
    ]);

    const slugOf = (row: Record<string, unknown>) =>
      typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : null;

    /* Category indexes rank above a single record and change whenever anything
       inside them does. Article and video categories share the section's own
       path (`/news/<slug>`), which is why neither carries a `/c/` segment --
       only the FAQ does. */
    for (const row of articleCategories) {
      const slug = slugOf(row);
      if (slug) base.push(entry(`/news/${slug}`, now, 0.7, "daily"));
    }
    for (const row of videoCategories) {
      const slug = slugOf(row);
      if (slug) base.push(entry(`/videos/${slug}`, now, 0.7, "daily"));
    }
    for (const row of faqCategories) {
      const slug = slugOf(row);
      if (slug) base.push(entry(`/services/faq/c/${slug}`, now, 0.7, "weekly"));
    }

    for (const row of articles) {
      const slug = slugOf(row);
      if (slug) base.push(entry(`/news/${slug}`, when(row.updated_at) ?? when(row.published_at), 0.6, "monthly"));
    }
    for (const row of videos) {
      const slug = slugOf(row);
      if (slug) base.push(entry(`/videos/${slug}`, when(row.updated_at), 0.6, "monthly"));
    }
    for (const row of faqs) {
      const slug = slugOf(row);
      if (slug) base.push(entry(`/services/faq/${slug}`, when(row.updated_at), 0.6, "monthly"));
    }
  } catch (error) {
    /* A sitemap listing the sections is worth having; a 500 is not. The build
       and the daily revalidation both reach the database, and if one of them
       cannot, the crawler still gets the twelve routes above rather than an
       error page it will hold against the site. */
    console.error("[sitemap] 取内容失败，只输出固定路由：", error);
  }

  /* Two rows can produce one URL -- an article and a category may share a slug
     under /news -- and a sitemap must not offer the same address twice. */
  const seen = new Set<string>();
  return base.filter((row) => (seen.has(row.url) ? false : (seen.add(row.url), true)));
}
