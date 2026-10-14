import { revalidatePath } from "next/cache";

/**
 * Drops the cached copy of a stored page, a material, or a taxonomy change.
 *
 * Articles and videos already clear their own caches on save. Everything else
 * an editor can change -- the 页面内容 under /about, /involve, /resources and
 * /services, the materials, the categories, a restored revision -- did not,
 * and those routes are `revalidate = 300`. So an editor saved, looked at the
 * public page, and saw the old one.
 *
 * Worse than the five minutes is what follows them: with
 * stale-while-revalidate the first visitor after expiry still gets the stale
 * copy and merely triggers a rebuild, so the *second* visitor sees the change.
 * On a quiet page that can be hours. An editor who checks, sees the old text,
 * edits again and still sees it is being told a lie by the cache.
 *
 * Same discipline as `revalidateNews`: name the exact paths. Never
 * `revalidatePath("/", "layout")` -- that is the "Publish now" button, and it
 * discards all 15,374 article caches at once, which is the load that took
 * Postgres down on 2026-10-13.
 */

/** `root`/`index` is the homepage; otherwise `/<section>` or `/<section>/<slug>`. */
export function pageRouteFor(section: string, slug: string): string {
  if (section === "root") return "/";
  return slug && slug !== "index" ? `/${section}/${slug}` : `/${section}`;
}

/**
 * One stored page.
 *
 * The homepage is included for any section, because it carries cards that
 * quote other pages -- a renamed service or a changed headline shows there
 * too, and leaving it stale is the same bug one level up.
 */
export function revalidatePage(section: string, slug = "index") {
  revalidatePath(pageRouteFor(section, slug));
  revalidatePath("/");
}

/**
 * A material, or the category it sits in.
 *
 * Materials live under /resources: the item itself, the category listing that
 * lists it, and the resources home that counts them.
 */
export function revalidateMaterials(slugs: Iterable<string> = [], categorySlugs: Iterable<string> = []) {
  /*
   * A material lives at /resources/downloads/<category>/<slug> and is listed
   * on /resources/downloads/<category>. This used to clear `/resources/<slug>`
   * -- an address materials have never had -- so the page that actually shows
   * them was left to expire on its own, which a production test caught.
   */
  for (const categorySlug of categorySlugs) {
    if (!categorySlug) continue;
    revalidatePath(`/resources/downloads/${categorySlug}`);
    for (const slug of slugs) {
      if (slug) revalidatePath(`/resources/downloads/${categorySlug}/${slug}`);
    }
  }
  revalidatePath("/resources");
  revalidatePath("/resources/downloads");
  revalidatePath("/");
}

/**
 * The FAQ.
 *
 * `/services/faq` is force-dynamic and reads the database on every request, so
 * it needs nothing. The entries are also reachable at their own addresses, and
 * the services home links them.
 */
export function revalidateFaq() {
  revalidatePath("/services");
  revalidatePath("/");
}
