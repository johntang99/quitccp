import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Keeps an address working after its slug changes.
 *
 * The slug box in every editor carries the warning 「改它会改变公开网址，原链接会
 * 失效」, and that was literally true: nothing recorded the old address, so a
 * rename turned every existing link -- another site's, a reader's bookmark, a
 * printed flyer -- into a 404, silently and permanently. `cms_redirects` has
 * existed the whole time, populated by the WordPress migration and read only by
 * the middleware, for one URL shape.
 *
 * ## Why the lookup is not in the middleware
 *
 * Middleware runs before every matched request. Broadening its matcher to
 * `/news/*` would mean a database round trip on each of 15,371 articles so that
 * the handful which were ever renamed resolve -- paying on the common path for
 * the rare one.
 *
 * Instead the routes ask here only when they are about to call `notFound()`.
 * A redirect exists precisely when the slug does not, so the lookup costs
 * nothing until the page was going to fail anyway.
 */

/** The public address of a piece of content, by kind. */
export const publicPath = {
  article: (slug: string) => `/news/${slug}`,
  video: (slug: string) => `/videos/${slug}`,
  faq: (slug: string) => `/services/faq/${slug}`,
  material: (categorySlug: string, slug: string) => `/resources/downloads/${categorySlug}/${slug}`
};

/**
 * Where `path` should go, or null.
 *
 * Both spellings are checked because the migrated rows carry a trailing slash
 * and ours do not.
 */
export async function findSlugRedirect(path: string): Promise<string | null> {
  try {
    const withSlash = path.endsWith("/") ? path : `${path}/`;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_redirects")
      .select("destination_url")
      .in("legacy_url", [path, withSlash])
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const destination = String(data.destination_url ?? "");
    /* Only ever redirect inside the site. A row that somehow held an absolute
       URL would otherwise turn a 404 into an open redirect. */
    return destination.startsWith("/") ? destination : null;
  } catch {
    /* A redirect lookup must not turn a 404 into a 500. */
    return null;
  }
}

/**
 * Records that `from` has become `to`, after a slug change.
 *
 * Two details that are easy to leave out and expensive to notice later:
 *
 * **Chains are collapsed.** Rename a piece twice and the first redirect would
 * point at an address that no longer exists, so A lands on a 404 by way of B.
 * Rows already pointing at `from` are repointed at `to`.
 *
 * **The new address is cleared of its own stale row.** If something was once
 * renamed away from `to` and is now renamed back, the leftover row would send
 * the live page somewhere else -- a redirect loop in the mild case.
 */
export async function recordSlugRedirect(from: string, to: string): Promise<void> {
  if (!from || !to || from === to) return;

  try {
    const supabase = createSupabaseAdminClient();

    await supabase.from("cms_redirects").delete().eq("legacy_url", to);
    await supabase.from("cms_redirects").update({ destination_url: to }).eq("destination_url", from);
    await supabase
      .from("cms_redirects")
      .upsert(
        /* 308, not the 301 the migrated rows carry, because that is what is
           actually served: `permanentRedirect` emits 308 and the App Router
           gives no way to choose. Both are permanent and search engines treat
           them alike; recording 301 here would simply be untrue. */
        { legacy_url: from, destination_url: to, status_code: 308 },
        { onConflict: "legacy_url" }
      );
  } catch {
    /* A save must not fail because the redirect could not be written. The
       content is the thing the editor came to change; a missing redirect is a
       broken old link, which is where we already were. */
  }
}
