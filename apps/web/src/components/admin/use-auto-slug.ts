"use client";

import { useEffect } from "react";

/**
 * Keeps 资料's slug field following its title, romanising Chinese as it goes.
 *
 * Only 资料. The other three libraries keep Chinese slugs, and deliberately:
 * 15,335 of 15,371 articles, 718 of 726 videos and all 46 FAQ answers already
 * have them, and those are found through search, where a Chinese address
 * matches a Chinese query. 资料 is the opposite -- all 24 of them were already
 * pinyin, because a download link's job is to be pasted somewhere.
 *
 * The romanisation needs a pinyin dictionary, which lives on the server, so the
 * suggestion is fetched rather than computed here.
 *
 * The fallback matters more than it looks. If the request fails -- offline, a
 * dropped session, a dev server restarting mid-keystroke -- the field still
 * gets a usable slug from the local rules, which is exactly what the editors
 * had before. A slug box that silently stops following the title would be a
 * worse failure than one that occasionally suggests the old shape.
 */

/** The old behaviour, kept as the offline answer. ASCII and CJK, nothing else. */
function localSlug(title: string, withDate: boolean): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "-")
    .replace(/[^0-9a-z㐀-䶿一-鿿-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base || !withDate) return base;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${base}`;
}

export function useAutoSlug(
  title: string,
  options: { enabled: boolean; withDate: boolean },
  onSlug: (slug: string) => void
) {
  const { enabled, withDate } = options;

  useEffect(() => {
    if (!enabled) return;
    if (!title.trim()) {
      onSlug("");
      return;
    }

    const controller = new AbortController();
    /* Typing a title fires this on every keystroke; 350ms is long enough that
       a normal phrase costs one request rather than a dozen. */
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ title, date: withDate ? "1" : "0" });
        const response = await fetch(`/api/admin/slug?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { slug?: string };
        onSlug(typeof data.slug === "string" ? data.slug : localSlug(title, withDate));
      } catch (error) {
        /* An abort is this effect being superseded by the next keystroke, not
           a failure -- answering it would overwrite the newer suggestion. */
        if ((error as Error)?.name === "AbortError") return;
        onSlug(localSlug(title, withDate));
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, enabled, withDate]);
}
