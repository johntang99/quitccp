import { NextResponse, type NextRequest } from "next/server";
import { isKnownLegacyId } from "@/lib/legacy-redirect-ids";

/**
 * Serves the 301s for the old WordPress URLs.
 *
 * `cms_redirects` held 15,513 rows that nothing read: the table was populated by
 * the migration but no code ever consulted it, so every inbound link from the
 * old site produced a 404.
 *
 * The matcher below restricts this to the one shape every legacy URL has --
 * /YYYY/MM/DD/<id>/ -- so a normal page request never pays for a lookup.
 *
 * ## Why the id is checked against a shipped set first
 *
 * This is the last place on the public path where a request can still reach
 * Postgres, and the 2026-10-13 flood is aimed at precisely this URL shape.
 *
 * Both caches below are keyed by the exact URL, which means they only help
 * when the same URL repeats. An attacker who randomises the id -- the same
 * trick as the `rnd=` parameter that defeated the CDN -- gets a cache miss
 * every time, and every miss is a guaranteed database query. Rate limiting
 * would only decide how fast that happens.
 *
 * So the question "could this id resolve at all?" is answered without the
 * database, from a 33 KB set of the ~15.5k ids that exist. An id outside it
 * is 404ed here having cost nothing, and no flood of invented ids can reach
 * Postgres. Regenerate the set after a migration:
 * `node scripts/build-legacy-id-set.mjs`.
 */

const LEGACY_PATH = /^\/\d{4}\/\d{2}\/\d{2}\/\d+\/?$/;

/** In-process cache; a popular old link is looked up once per instance. */
const cache = new Map<string, string | null>();
const CACHE_LIMIT = 500;

async function lookup(path: string): Promise<string | null> {
  if (cache.has(path)) return cache.get(path) ?? null;

  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  // Both spellings are stored across the corpus, so ask for either.
  const withSlash = path.endsWith("/") ? path : `${path}/`;
  const withoutSlash = withSlash.slice(0, -1);
  const url =
    `${base}/rest/v1/cms_redirects?select=destination_url&limit=1` +
    `&legacy_url=in.(${encodeURIComponent(`"${withSlash}","${withoutSlash}"`)})`;

  try {
    const response = await fetch(url, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      // A redirect target changes only when the migration reruns.
      next: { revalidate: 3600 }
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as { destination_url?: string }[];
    const destination = rows[0]?.destination_url ?? null;
    if (cache.size > CACHE_LIMIT) cache.clear();
    cache.set(path, destination);
    return destination;
  } catch {
    // A lookup failure must not take the page down; fall through to the 404.
    return null;
  }
}

/** `/2023/01/25/690040/` -> `/news/a/690040`, the id route for old articles. */
function legacyIdPath(pathname: string): string | null {
  const id = pathname.match(/\/(\d+)\/?$/)?.[1];
  return id ? `/news/a/${id}` : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * `/news/a/<id>` is the destination of the redirect below, and nothing stops
   * a request arriving there directly -- so it needs the same gate, one step
   * earlier than the route itself can apply it.
   *
   * The route does check the id, but by the time a route can call
   * `notFound()` the layout has already rendered, and the layout reads the
   * theme and the navigation: three database queries per invented id,
   * measured. Refusing here means nothing renders at all. An unmatched URL
   * gets Next's prerendered 404, which costs no queries, so that is what an
   * unknown id is turned into.
   */
  const directId = pathname.match(/^\/news\/a\/(\d+)\/?$/)?.[1];
  if (directId !== undefined) {
    if (isKnownLegacyId(Number(directId))) return NextResponse.next();
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }

  if (!LEGACY_PATH.test(pathname)) return NextResponse.next();

  /*
   * Before the database: can this id resolve at all?
   *
   * An id we have never heard of cannot produce a redirect by either route
   * below, so asking Postgres about it only ever returns "no" -- at the cost
   * of a connection. Answering from the shipped set instead is what stops a
   * flood of invented ids from becoming a flood of queries.
   */
  const id = Number(pathname.match(/\/(\d+)\/?$/)?.[1]);
  if (!Number.isInteger(id) || !isKnownLegacyId(id)) return NextResponse.next();

  /*
   * The table first, then the id.
   *
   * `cms_redirects` gives the readable slug, which is the better destination
   * when it has a row. But it does not have one for every old article -- the
   * 2023/01/25/690040 form appears six times in our own article bodies and
   * 404s today -- and `/news/a/<id>` resolves exactly the same article by the
   * id already sitting in the path. Falling through to it turns those into
   * working links, and where the article genuinely was not migrated it 404s
   * there instead of here, which is no worse.
   */
  const destination = (await lookup(pathname)) ?? legacyIdPath(pathname);
  if (!destination) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = destination;
  target.search = "";
  return NextResponse.redirect(target, 301);
}

export const config = {
  matcher: [
    "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:id(\\d+)",
    "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:id(\\d+)/",
    /* The redirect's own destination, so an invented id is refused before any
       layout renders. See the note at the top of `middleware`. */
    "/news/a/:id(\\d+)",
    "/news/a/:id(\\d+)/"
  ]
};
