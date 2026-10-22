import type { Metadata } from "next";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { NewsListingPage } from "@/components/public/news/NewsListingPage";
import type { NewsSort } from "@/lib/public-content";
import { getNewsListing, isNewsListingSlug } from "@/lib/public-content";

/**
 * Page two and beyond of a news listing, and the sort toggle.
 *
 * ## Why paging moved out of the query string
 *
 * It used to be `/news/<slug>?page=2`, handled by `/news/[slug]` alongside
 * every article. Reading `searchParams` there marked that whole route dynamic,
 * and Next then sets `no-store` on it no matter what `revalidate` says -- so
 * all 15,374 articles were rendered fresh, with a database round trip, on every
 * single request. The 2026-10-13 flood was built around precisely that: 477
 * million hits on one article, none of which a cache was allowed to answer.
 *
 * Paging is the only thing that needed the query string, and only twelve
 * listing slugs have anything to page through. Moving it here leaves
 * `/news/[slug]` free of dynamic APIs, and this route can stay dynamic because
 * nobody floods page seven.
 *
 * `/news/<slug>` is still page one, so the addresses readers and search engines
 * actually hold are unchanged. Only `?page=N` becomes `/N`.
 */
export const maxDuration = 15;

async function listingFor(slugRaw: string, pageRaw: string, sortRaw?: string) {
  if (!(await isNewsListingSlug(slugRaw))) return null;
  const page = Number(pageRaw);
  /* `/news/<slug>/0` and `/news/<slug>/abc` are not addresses we mint. */
  if (!Number.isInteger(page) || page < 1) return null;
  const sort: NewsSort = sortRaw === "oldest" ? "oldest" : "latest";
  const listing = await getNewsListing(slugRaw, page, sort);
  if (!listing) return null;
  /* Past the last page there is nothing to show, and this route is dynamic:
     without this, /news/<slug>/2 .. /99999 is an unbounded set of addresses
     that each render and query the database. That is the shape of the thing
     this whole change exists to remove, so it must not be reintroduced here. */
  if (listing.page > listing.pageCount) return null;
  return listing;
}

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; page: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const { slug, page } = await params;
  const query = await searchParams;
  const listing = await listingFor(slug, page, query.sort);
  if (!listing) return {};
  return {
    title: `${listing.name}（第 ${listing.page} 页）`,
    description: t("news.listingDescription", { name: listing.name, site: t("site.name"), total: formatNumber(listing.total) }),
    /* Page one is the canonical for the set; deeper pages point at themselves
       so they are not read as duplicates of it. */
    alternates: { canonical: listing.page === 1 ? `/news/${slug}` : `/news/${slug}/${listing.page}` }
  };
}

export default async function NewsListingPagedPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; page: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug, page } = await params;
  const query = await searchParams;
  const listing = await listingFor(slug, page, query.sort);
  if (!listing) notFound();
  return <NewsListingPage listing={listing} />;
}
