import { NextResponse } from "next/server";
import { getNewsListing, NEWS_LISTING_SLUGS } from "@/lib/public-content";
import { NEWS_MAX_CHUNK } from "@/components/public/news/newsChunks";

/**
 * One screenful of a listing, for the infinite scroll to append.
 *
 * ## Why this is a path and not a query string
 *
 * `/news/<slug>/chunk/3` and not `/api/news?slug=…&offset=26`. The difference
 * is the whole reason this is safe to ship on a site that was taken down by a
 * flood three days ago: a path is a finite set of addresses a CDN caches, and
 * a query string is an infinite set it does not. The second form would have
 * handed an attacker a database read per request, behind no cache, which is
 * precisely the shape of the thing that broke Postgres on 2026-10-13.
 *
 * ## Why a chunk is a page
 *
 * `CHUNK_SIZE` is the listing's own page size, so chunk N holds exactly what
 * `/news/<slug>/N` holds. Nothing new is computed, nothing can disagree, and
 * when the reader reaches the cap the "继续浏览" link hands them straight to
 * page CAP+1 of the pagination that still exists underneath.
 *
 * ## Why there is a cap
 *
 * 15 chunks, 195 articles. Past that, scrolling is a worse way to find
 * something than searching for it, and an unbounded scroll on a 8,612-article
 * category is a way to make a phone run out of memory. The listing's own pages
 * carry on from there.
 */
export const revalidate = 300;

/** The listing's page size. Chunk N is page N; see above. */
const CHUNK_SIZE = 13;

/** Shared with the listing page so the two agree on where scrolling stops. */
const MAX_CHUNK = NEWS_MAX_CHUNK;

/**
 * Every chunk there is, named at build time.
 *
 * ## Why this exists, and what it fixes
 *
 * Without it this route was dynamic. It still *looked* cached -- `age` climbed
 * and `x-vercel-cache` said HIT -- because the handler set its own
 * `cache-control: s-maxage=300`, which parks the response in the CDN's
 * plain time-based cache. That cache knows nothing about Next's tags, so
 * `revalidatePath` could not reach it: a measured save cleared the four pages
 * it was aimed at and left all four chunks on HIT. The first thirteen rows of
 * a listing went fresh while everything the reader scrolled to stayed up to
 * five minutes old -- the two halves of one list disagreeing, which shows as
 * an article missing from the scroll after a publish, or a row appearing twice
 * after an unpublish.
 *
 * Naming the params makes these prerendered routes instead, in the same ISR
 * layer as `/news/<slug>` (`x-nextjs-prerender: 1`), which is the layer
 * `revalidatePath` actually invalidates. The custom `cache-control` header is
 * gone with it: setting one is what opted the route out in the first place.
 *
 * ## The cost
 *
 * 11 listings x 14 chunks = 154 small JSON renders at build, one query each.
 * Listings with a single page get chunks that are correctly empty; generating
 * them is cheaper than reasoning about which slugs deserve how many.
 *
 * Params outside this set still reach the handler and are refused by the
 * bounds check below, so this is not the security boundary -- only the list of
 * addresses worth building ahead of time.
 */
export function generateStaticParams() {
  const params: { slug: string; n: string }[] = [];
  for (const slug of NEWS_LISTING_SLUGS) {
    for (let chunk = 2; chunk <= MAX_CHUNK; chunk++) {
      params.push({ slug, n: String(chunk) });
    }
  }
  return params;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; n: string }> }
) {
  const { slug, n } = await params;
  const chunk = Number(n);

  /* Bounded and validated before anything touches the database: these are
     public addresses, and `chunk` arrives as text from a stranger. */
  if (!Number.isInteger(chunk) || chunk < 2 || chunk > MAX_CHUNK) {
    return NextResponse.json({ error: "out of range" }, { status: 404 });
  }
  if (!NEWS_LISTING_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "no such listing" }, { status: 404 });
  }

  const listing = await getNewsListing(slug, chunk, "latest", CHUNK_SIZE);
  if (!listing) return NextResponse.json({ error: "no such listing" }, { status: 404 });

  return NextResponse.json(
    {
      items: listing.items,
      /* So the client knows to stop without a second request: either the
         listing ran out, or the cap did. */
      hasMore: chunk < Math.min(listing.pageCount, MAX_CHUNK),
      nextPage: chunk + 1,
      pageCount: listing.pageCount,
      total: listing.total
    }
  );
}
