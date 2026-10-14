"use client";

/**
 * Asks the browser to fetch the given public pages, so they are built before
 * anyone reads them. See warm-paths.ts for why this runs here and not on the
 * server.
 *
 * Deliberately silent. A warm-up that fails costs nothing -- the page simply
 * stays lazy, which is how it behaved before any of this existed -- and an
 * editor who has just saved successfully should not be shown a second,
 * frightening message about a background detail they did not ask for.
 *
 * Fire-and-forget: the editor's save is already finished, and nothing they do
 * next should wait on this.
 */
export function warmPages(paths: Iterable<string>) {
  if (typeof window === "undefined") return;

  for (const path of paths) {
    if (!path || !path.startsWith("/")) continue;
    /*
     * Default credentials, i.e. cookies included. That matters: the firewall's
     * clearance from the challenge the editor already solved rides on a
     * cookie, and omitting it would get the warm-up challenged instead of
     * served. The public routes read no cookies of their own -- they could not
     * be static if they did -- so sending the admin session along changes
     * nothing about what comes back.
     */
    void fetch(path, { cache: "no-store" }).catch(() => {
      /* Warming is best-effort by design. */
    });
  }
}
