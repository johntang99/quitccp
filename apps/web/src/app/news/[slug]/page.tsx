import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { findSlugRedirect, publicPath } from "@/lib/slug-redirects";
import { NewsListingPage } from "@/components/public/news/NewsListingPage";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import type { NewsSort } from "@/lib/public-content";
import { getNewsListing, getRenderableArticle, isNewsListingSlug } from "@/lib/public-content";

/**
 * A content page renders in about a second. Without this it inherits Vercel's
 * 300-second ceiling, and on 2026-10-13 that ceiling is what turned a flood
 * into an outage: ~500 req/s against one article saturated Postgres, every
 * request then blocked on a query it would never get, and each one held its
 * database connection for the full five minutes. The connections never came
 * back fast enough to drain, Postgres stopped accepting new ones, and the
 * whole project went dark -- 86,000 FUNCTION_INVOCATION_TIMEOUTs in 12 hours.
 *
 * Fifteen seconds is far more than this page needs and far less than it takes
 * to exhaust the database. Under load the site now gets slow and sheds
 * requests instead of holding them until something breaks.
 */
export const maxDuration = 15;

/**
 * Lets a copy of the page exist between the reader and Postgres.
 *
 * Without this the route carries `no-store`: every request renders fresh and
 * queries the database, which is exactly the property the 2026-10-13 flood was
 * built around -- 477 million hits on one article, each one its own function
 * invocation and database round trip. The same flood against a cached route is
 * a CDN hit that costs nothing and never reaches Postgres.
 *
 * Five minutes matches `/news` and the homepage, which have been served this
 * way all along. An editor's save calls `revalidatePath`, so a change still
 * appears at once; this is only the ceiling for everything else.
 */
export const revalidate = 300;


/**
 * /news/<something> is either a category listing or an article.
 *
 * Listing first: those slugs are latin and fixed -- the eight categories plus
 * archive / latest / featured / editor-archive -- while article slugs are the
 * Chinese title (now date-prefixed), so the two cannot collide. The old menu
 * slugs -- announcements, investigations, commentary and the rest -- pointed at
 * CMS pages that the real categories replace.
 */
/**
 * Each article's own title, summary and address.
 *
 * Until now every one of the 15,527 pages under /news carried the site's own
 * title and description, because nothing here declared any, and the root
 * layout additionally claimed the homepage as their canonical. To a search
 * engine that reads as fifteen thousand copies of one page.
 *
 * `getRenderableArticle` runs again here, but Next caches a fetch within a
 * single render, so this costs the lookup rather than the whole page.
 */
export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  /* `slug` arrives as it appears in the address -- already percent-encoded for
     a Chinese title -- so the canonical uses it unchanged. Encoding it again
     turned %E4 into %25E4 and pointed every article at a URL that does not
     exist. */
  const { slug } = await params;

  const listing = await getNewsListing(slug, 1, "latest");
  if (listing) {
    return {
      title: listing.name,
      description: `${listing.name}——全球退党服务中心的${listing.total.toLocaleString("zh-CN")}篇报导与资料。`,
      alternates: { canonical: `/news/${slug}` }
    };
  }

  const article = await getRenderableArticle(slug);
  if (!article) return {};
  const content = (article.content ?? {}) as Record<string, unknown>;
  const summary = typeof content.dek === "string" ? content.dek : "";
  return {
    title: article.title,
    description: summary.slice(0, 180) || undefined,
    alternates: { canonical: `/news/${slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: summary.slice(0, 180) || undefined
    }
  };
}

export default async function NewsSlugPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;

  /* `searchParams` is read inside this branch and nowhere else. Awaiting it
     marks the render dynamic, and it used to sit above this line, so all
     15,374 articles were rendered fresh on every request even though only the
     twelve listing pages have anything to page through. See
     `isNewsListingSlug`. */
  if (isNewsListingSlug(slug)) {
    const query = await searchParams;
    const page = Number(query.page ?? "1") || 1;
    const sort: NewsSort = query.sort === "oldest" ? "oldest" : "latest";

    const listing = await getNewsListing(slug, page, sort);
    if (listing) return <NewsListingPage listing={listing} />;
  }

  const article = await getRenderableArticle(slug);
  /* Only once the slug has failed to resolve. A renamed article is rare; the
     other 15,370 must not pay for a redirect lookup they never need. */
  if (!article) {
    const moved = await findSlugRedirect(publicPath.article(decodeURIComponent(slug)));
    if (moved) permanentRedirect(moved);
    notFound();
  }
  return <TemplateRenderer {...article} />;
}
