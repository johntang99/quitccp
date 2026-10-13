import { notFound } from "next/navigation";
import { VideoCategoryPage } from "@/components/public/videos/VideoCategoryPage";
import type { VideoSort } from "@/lib/public-content";
import { getVideoCategory, listPublicVideoCategories } from "@/lib/public-content";

/**
 * Page two and beyond of a video series, and the sort toggle.
 *
 * The counterpart of /news/[slug]/[page], and for the same reason: reading
 * `searchParams` in /videos/[[...slug]] marked that whole route dynamic, so
 * every one of the 760 films was rendered fresh, with its database queries, on
 * every request. Paging is the only thing that needed the query string, and
 * only the series listings have anything to page through.
 *
 * `/videos/<series>` is still page one, so the addresses readers hold are
 * unchanged; only `?page=N` becomes `/N`.
 */
export const maxDuration = 15;

async function listingFor(slug: string, pageRaw: string, sortRaw?: string) {
  const page = Number(pageRaw);
  /* Addresses we never mint. */
  if (!Number.isInteger(page) || page < 1) return null;
  const sort: VideoSort = sortRaw === "oldest" ? "oldest" : "latest";
  const category = await getVideoCategory(slug, page, sort);
  if (!category) return null;
  /* Past the last page there is nothing to show, and this route is dynamic:
     without this, /2 .. /99999 is an unbounded set of addresses that each
     render and query the database. */
  if (category.page > category.pageCount) return null;
  return category;
}

export default async function VideoCategoryPagedPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; page: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug, page } = await params;
  const query = await searchParams;
  const category = await listingFor(slug, page, query.sort);
  if (!category) notFound();
  const siblings = await listPublicVideoCategories();
  return <VideoCategoryPage category={category} siblings={siblings} />;
}
