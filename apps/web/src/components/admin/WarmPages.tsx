"use client";

import { useEffect } from "react";
import { warmPages } from "@/lib/admin/warm-pages";

/**
 * Warms the public pages named in `?warm=` after a save that redirected.
 *
 * The article and video forms save over fetch and get the list back in the
 * response, so they warm directly. A form that posts and redirects -- the
 * material editor -- has no such moment, so the paths ride in the query string
 * and this picks them up on the way back.
 *
 * It then removes the parameter from the address bar, so a refresh or a
 * bookmarked URL does not fetch them all again.
 */
export function WarmPages() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("warm");
    if (!raw) return;

    warmPages(raw.split(",").map((path) => path.trim()));

    url.searchParams.delete("warm");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return null;
}
