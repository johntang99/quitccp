import { NextResponse, type NextRequest } from "next/server";

/**
 * Serves the 301s for the old WordPress URLs.
 *
 * `cms_redirects` held 15,513 rows that nothing read: the table was populated by
 * the migration but no code ever consulted it, so every inbound link from the
 * old site produced a 404.
 *
 * The matcher below restricts this to the one shape every legacy URL has --
 * /YYYY/MM/DD/<id>/ -- so a normal page request never pays for a lookup.
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!LEGACY_PATH.test(pathname)) return NextResponse.next();

  const destination = await lookup(pathname);
  if (!destination) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = destination;
  target.search = "";
  return NextResponse.redirect(target, 301);
}

export const config = {
  matcher: ["/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:id(\\d+)", "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:id(\\d+)/"]
};
