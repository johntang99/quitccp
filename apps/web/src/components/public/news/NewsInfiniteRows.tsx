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
  maxChunk
}: {
  slug: string;
  /** The last chunk already on the page -- 1, server-rendered. */
  startPage: number;
  pageCount: number;
  total: number;
  maxChunk: number;
}) {
  const [items, setItems] = useState<NewsCard[]>([]);
  const [next, setNext] = useState(startPage + 1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const capped = next > Math.min(pageCount, maxChunk);
  const sentinel = useRef<HTMLDivElement>(null);

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
      setItems((current) => [...current, ...data.items]);
      setNext((current) => current + 1);
      /* The address follows the reader; see the note above. Guarded because a
         sandboxed or cross-origin frame throws on history writes. */
      try {
        window.history.replaceState(null, "", `/news/${encodeURIComponent(slug)}/${next}`);
      } catch {
        /* Not being able to update the address is not a reason to stop. */
      }
    } catch {
      /* One failure must not spin: the reader gets a button and decides. */
      setFailed(true);
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

      {failed ? (
        <div style={{ padding: "18px 0", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => void load()}
            style={{
              font: "inherit",
              fontSize: 14,
              color: T.seal,
              background: "transparent",
              border: `1px solid ${T.rule}`,
              borderRadius: 4,
              padding: "8px 18px",
              cursor: "pointer"
            }}
          >
            载入失败，点这里重试
          </button>
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
