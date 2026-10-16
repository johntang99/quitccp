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
    },
    {
      headers: {
        /*
         * Cached at the edge, by time, and deliberately not for long.
         *
         * This is the CDN's plain time-based cache, which Next's tags do not
         * reach: a measured save clears `/news/<slug>` (HIT -> REVALIDATED)
         * and leaves every chunk on HIT. So a save makes the first thirteen
         * rows fresh while the rest of the scroll lags, which shows as one
         * article missing after a publish or one row repeated after an
         * unpublish -- for as long as this number says.
         *
         * The obvious fix is to make these prerendered routes, in the ISR
         * layer `revalidatePath` does reach. It was tried on 2026-10-16:
         * `generateStaticParams` over the 168 chunks builds correctly here
         * and then fails Vercel's builder with
         * `ENOENT lstat .next/server/pages/500.js` -- a file no build writes,
         * orphan trace removed or not, on the previous commit too. So the
         * window is bounded instead of closed: 60 seconds rather than 300.
         *
         * `stale-while-revalidate` so nobody waits on a rebuild mid-scroll,
         * and the cost of the shorter window is at most one indexed query per
         * chunk per minute, only for chunks somebody is actually reading.
         */
        "cache-control": "public, s-maxage=60, stale-while-revalidate=86400"
      }
    }
  );
}
