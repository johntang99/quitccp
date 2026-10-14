"use client";

import { useEffect } from "react";
import { warmPages } from "@/lib/admin/warm-pages";

/**
 * Warms the public pages named in `#warm=` after a save that redirected.
 *
 * The article and video forms save over fetch and get the list back in the
 * response, so they warm directly. A form that posts and redirects -- deleting
 * an article, saving a material -- has no such moment, so the paths travel
 * back with the redirect and this picks them up.
 *
 * ## Why the fragment and not a query parameter
 *
 * It was `?warm=`, and testing a real delete on production showed why that is
 * wrong: the page it lands on builds its own links from the parameters it was
 * given, so every filter, page number and page-size link came back carrying
 * `?warm=/,/news`. Clicking any of them would have warmed the pages again, and
 * the parameter would have spread through the admin by being bookmarked and
 * shared.
 *
 * A fragment is never sent to the server, so nothing can render it into a
 * link. It is cleared here anyway, so a refresh does not repeat the work.
 */
export function WarmPages() {
  useEffect(() => {
    const raw = window.location.hash.startsWith("#warm=")
      ? decodeURIComponent(window.location.hash.slice("#warm=".length))
      : "";
    if (!raw) return;

    warmPages(raw.split(",").map((path) => path.trim()));

    const url = new URL(window.location.href);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  return null;
}
