"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsCard } from "@/lib/public-content";
import { NewsRow } from "./NewsRow";
import { T } from "./newsTokens";

/**
 * Appends further chunks of a listing as the reader approaches the end.
 *
 * ## What this is allowed to break: nothing
 *
 * The first chunk is server-rendered by the page, exactly as before, so a
 * reader with no JavaScript sees what they saw yesterday. This component only
 * ever *adds*. If it never loads, never runs, or every fetch fails, the page
 * is still the page -- with its pagination, which the parent keeps rendering
 * for precisely that reason.
 *
 * That matters more here than on most sites: a large share of these readers
 * reach the site through a reverse proxy from inside China, on connections
 * where a script can simply not arrive.
 *
 * ## The address bar follows the scroll
 *
 * Each time a chunk lands, the URL becomes `/news/<slug>/<n>` via
 * `replaceState`. Reload, share or hit back and you land where you were
 * reading rather than at the top of a list you have already scrolled past.
 * `replaceState` and not `pushState`: a reader scrolling through five chunks
 * should press back once to leave, not five times.
 */
export function NewsInfiniteRows({
  slug,
  startPage,
  pageCount,
  total,
  maxChunk,
  shownSlugs
}: {
  slug: string;
  /** The last chunk already on the page -- 1, server-rendered. */
  startPage: number;
  pageCount: number;
  total: number;
  maxChunk: number;
  /** The slugs the server already rendered; see `seen` below. */
  shownSlugs: string[];
}) {
  const [items, setItems] = useState<NewsCard[]>([]);
  const [next, setNext] = useState(startPage + 1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const capped = next > Math.min(pageCount, maxChunk);
  const sentinel = useRef<HTMLDivElement>(null);
  /** One silent retry per failure, then the pager takes over. */
  const retried = useRef(false);

  /*
   * Every slug the reader has already been shown, so no chunk can repeat one.
   *
   * The halves of a listing go stale at different moments: page one is cleared
   * the instant an editor saves, while the chunks behind it age out on their
   * own clock. Unpublish an article off page one and the article that moves up
   * to take its place is both the last row the server rendered and the first
   * row of the chunk that was cached before the change -- so it arrives twice,
   * which is the one version of this a reader actually notices (React also
   * warns about the repeated key).
   *
   * Seeded from the server's own rows rather than read back out of the DOM:
   * the parent already has them, and a component that scrapes the page it was
   * rendered into breaks the first time the markup around it changes.
   *
   * The mirror case -- an article published onto page one pushing the old last
   * row into a chunk that has not been rebuilt yet, so it is briefly skipped --
   * is not something this can fix, and is not something a reader can see.
   */
  const seen = useRef(new Set(shownSlugs));

  /*
   * Tells the stylesheet that scrolling is actually running, so the pager can
   * be folded away -- and only then.
   *
   * The first version keyed that off an attribute the server wrote, which was
   * wrong in the one case the whole fallback exists for: the markup says
   * "this page scrolls" whether or not the script ever arrives, so CSS hid the
   * pager for readers who had no scroll either. They would have been left with
   * thirteen articles and no way forward -- on the connections where that is
   * most likely, behind the proxy from inside China.
   *
   * Set from an effect, which runs only if this component mounted, which
   * happens only if the script loaded and ran.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-news-scroll", "on");
    return () => root.removeAttribute("data-news-scroll");
  }, []);

  const load = useCallback(async () => {
    if (loading || capped) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/news/${encodeURIComponent(slug)}/chunk/${next}`);
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { items: NewsCard[]; hasMore: boolean };
      const fresh = data.items.filter((item) => !seen.current.has(item.slug));
      for (const item of fresh) seen.current.add(item.slug);
      setItems((current) => [...current, ...fresh]);
      /* A good chunk restores the retry budget: one blip early in a long
         scroll should not leave the rest of it without a second chance. */
      retried.current = false;
      setNext((current) => current + 1);
      /* The address follows the reader; see the note above. Guarded because a
         sandboxed or cross-origin frame throws on history writes. */
      try {
        window.history.replaceState(null, "", `/news/${encodeURIComponent(slug)}/${next}`);
      } catch {
        /* Not being able to update the address is not a reason to stop. */
      }
    } catch {
      /*
       * Retried once, quietly, then handed back to the pager.
       *
       * The first version put「载入失败，点这里重试」on the page. It was
       * honest -- the dev server really was down when it appeared -- but it
       * asks the reader to deal with our problem, in the middle of what they
       * were reading. They did not come here to retry a request.
       *
       * The pager is still in the DOM, only folded away by CSS. Dropping the
       * marker brings it back, so a failed scroll lands the reader exactly
       * where they would have been without any of this: a list and a 下一页
       * link. No message, nothing to decide.
       *
       * One silent retry first, because on the connections most of these
       * readers are on, the usual cause is a single request that did not make
       * it rather than anything being wrong.
       */
      if (!retried.current) {
        retried.current = true;
        setLoading(false);
        window.setTimeout(() => void load(), 1200);
        return;
      }
      setFailed(true);
      try {
        document.documentElement.removeAttribute("data-news-scroll");
      } catch {
        /* Nothing to do if the document is gone. */
      }
    } finally {
      setLoading(false);
    }
  }, [slug, next, loading, capped]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || capped || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load();
      },
      /* Starts a chunk before the reader reaches the end, so the list grows
         under them rather than stopping and then jumping. */
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, capped, failed]);

  const shown = startPage * 13 + items.length;

  return (
    <>
      {items.map((item) => (
        <NewsRow key={item.slug} item={item} />
      ))}

      {/* Announced politely so a screen reader is told the list grew rather
          than silently finding more rows under it. */}
      <div aria-live="polite" className="sr-only">
        {loading ? "正在载入更多文章" : items.length > 0 ? `已显示 ${shown} 篇` : ""}
      </div>

      {!capped && !failed ? (
        <div ref={sentinel} style={{ padding: "18px 0", textAlign: "center", color: T.muted, fontSize: 14 }}>
          {loading ? "载入中…" : " "}
        </div>
      ) : null}

      {capped && items.length > 0 ? (
        <div style={{ padding: "22px 0 4px", textAlign: "center", fontSize: 14, color: T.muted }}>
          {pageCount > maxChunk ? (
            <>
              已显示 {shown} 篇，本栏共 {total.toLocaleString("zh-CN")} 篇。
              {" "}
              <a href={`/news/${encodeURIComponent(slug)}/${maxChunk + 1}`} style={{ color: T.seal }}>
                继续浏览 →
              </a>
            </>
          ) : (
            <>本栏文章已全部显示（共 {total.toLocaleString("zh-CN")} 篇）。</>
          )}
        </div>
      ) : null}
    </>
  );
}
