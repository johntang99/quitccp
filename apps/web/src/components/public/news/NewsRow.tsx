import type { NewsCard } from "@/lib/public-content";
import { T, articleHref, day } from "./newsTokens";

/**
 * One article in a listing.
 *
 * Moved out of NewsListingPage unchanged, so the same markup serves the
 * server-rendered first chunk and the chunks the browser fetches while
 * scrolling. Two copies of this -- one per rendering path -- is how a list
 * ends up with rows that do not quite match each other.
 *
 * No "use client": it has no state and no handlers, so it renders on the
 * server for the first chunk and inside the client component for the rest.
 * Its only imports are plain constants and two pure functions.
 */
export function NewsRow({ item }: { item: NewsCard }) {
  return (
    <a className="news-cat-row" data-noimage={item.image ? undefined : ""} href={articleHref(item.slug)}>
      {/*
        没有图就整个不画这一格，而不是画一块灰色占位。
        
        全站 15,368 篇已发布文章里有 9,343 篇没有封面 —— 旧 WordPress 已经
        不存在，2026-10-10 那轮 Wayback 存档恢复能找回的都找回了，剩下的
        是真的没有了。一行一块空灰框，读者读到的是「这里本该有张图，坏了」；
        不画，读者读到的是一条文字条目。后者是实话。
        
        `data-noimage` 让 CSS 把网格从「240px + 文字」收成单列，否则空出来的
        那 240px 会变成一块无法解释的留白。
      */}
      <span className="news-cat-row-thumb">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            style={{ width: "100%", aspectRatio: "16 / 9", height: "auto", objectFit: "cover", display: "block" }}
          />
        ) : null}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 8, paddingRight: 8 }}>
        <span
          className="news-clamp-2"
          style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 20, lineHeight: 1.5 }}
        >
          {item.title}
        </span>
        {item.summary ? (
          <span className="news-clamp-2" style={{ fontSize: 14, lineHeight: "var(--lh-body)", color: T.muted }}>
            {item.summary}
          </span>
        ) : null}
        <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2, fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.mono, color: T.mutedSoft, whiteSpace: "nowrap" }}>{day(item.publishedAt)}</span>
          {item.category ? <span className="news-cat-tag">{item.category}</span> : null}
          <span style={{ marginLeft: "auto", color: T.seal, fontSize: 13 }}>阅读 →</span>
        </span>
      </span>
    </a>
  );
}
