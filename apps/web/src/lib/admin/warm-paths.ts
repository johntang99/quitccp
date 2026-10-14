import { publicPath } from "@/lib/slug-redirects";

/**
 * The pages worth generating straight after a save, instead of leaving them to
 * the first visitor.
 *
 * ## Why warm anything at all
 *
 * Clearing a cache does not rebuild the page; it marks it stale, and the next
 * request pays for a full render (measured: MISS, blocking, ~1.5s for an
 * article). Usually that is the right trade -- nobody rebuilds pages no one
 * reads. But two groups of people reliably hit that first request: the editor
 * who just saved and wants to check their work, and the next reader of the
 * homepage, which is the busiest page on the site.
 *
 * ## Why only three
 *
 * A save invalidates fifteen addresses. Warming all fifteen would mean fifteen
 * database renders every time an editor presses save, most of them for
 * category listings nobody is about to open. These three are where a new
 * article actually shows up and where someone is actually about to look.
 * The other twelve stay lazy, which is what lazy is for.
 *
 * ## Why the browser does it, not the server
 *
 * A fetch from our own function is a non-browser request, and Bot Protection
 * challenges those -- the warm-up would quietly fetch a verification page and
 * warm nothing, while looking like it worked. The editor's browser already
 * holds a solved challenge, so the request goes through as an ordinary read.
 * It also means the cost lands on a real signed-in session rather than on an
 * anonymous server loop that an attacker could learn to trigger.
 */

/**
 * A new or edited article shows up here.
 *
 * The article's own address is only worth warming once it is published. A
 * draft has no public page, so fetching it caches a 404 -- which a production
 * test of a draft save duly produced. Publishing clears that entry again, so
 * it was harmless, but it was also pointless work and an alarming thing for an
 * editor to find in their browser's console.
 */
export function warmPathsForArticle(slug: string, status?: string): string[] {
  const paths = ["/", "/news"];
  if (slug && status === "published") paths.push(`/news/${encodeURIComponent(slug)}`);
  return paths;
}

/** Same for a video: the home page carries the latest, /videos lists them. */
export function warmPathsForVideo(slug: string, status?: string): string[] {
  const paths = ["/", "/videos"];
  if (slug && status === "published") paths.push(`/videos/${encodeURIComponent(slug)}`);
  return paths;
}

/**
 * Materials are not on the homepage, so warming it would be wasted work --
 * the resources index and the download index are where they appear.
 *
 * The item's own address is `/resources/downloads/<category>/<slug>`, not
 * `/resources/<slug>`. A production test warmed the second shape and got a
 * 404: it is not where materials live, and no amount of warming makes it one.
 * `publicPath.material` is the single definition of that address, so this uses
 * it rather than spelling the path out a second time and drifting again.
 *
 * Without a category there is no item address to warm, only the indexes.
 */
export function warmPathsForMaterial(slug: string, categorySlug?: string): string[] {
  if (!categorySlug) return ["/resources/downloads"];
  /* Measured on production: a material shows on its category listing and on
     its own page. It is on neither /resources nor /resources/downloads, so
     warming those would build pages that did not change. */
  const paths = [`/resources/downloads/${categorySlug}`];
  if (slug) paths.push(publicPath.material(categorySlug, slug));
  return paths;
}

/**
 * A deletion leaves nothing to warm at the item's own address -- fetching it
 * would only cache a 404 that nobody asked for. The listings still change.
 */
export function warmPathsForDeletedArticle(): string[] {
  return ["/", "/news"];
}

export function warmPathsForDeletedVideo(): string[] {
  return ["/", "/videos"];
}
