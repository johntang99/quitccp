import { NEWS_CATEGORIES } from "@/lib/public-content";
import { T } from "./newsTokens";

/**
 * The masthead, with the category row sitting inside it on the gradient.
 *
 * The design runs the tabs along the bottom of the header and leaves 72px of
 * gradient below them, so the hero card can lift up over the join.
 *
 * Listing pages pass `listing` to swap the section identity for their own --
 * breadcrumb, category name, `EN · N 篇` -- while keeping the same tab row, so a
 * reader can always see every category and which one they are in. The category
 * pages first shipped with a header of their own that dropped the tabs, which
 * left no way to move between categories from inside one.
 */
export function NewsHeader({
  active,
  today,
  listing
}: {
  active?: string;
  /** Only used by the section index, whose kicker is NEWSROOM · <date>. */
  today?: string;
  listing?: { name: string; en: string; total: number };
}) {
  // archive and latest are the whole section, so 全部 is the tab they belong to.
  const wholeSection = active === "archive" || active === "latest";
  const activeTab = wholeSection ? undefined : active;
  return (
    <header
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #251E5E 0%, #362C88 55%, #4739A0 100%)",
        color: "#fff"
      }}
    >
      <span
        style={{
          position: "absolute",
          right: -160,
          top: -300,
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(242,211,138,0.22), rgba(242,211,138,0) 100%)"
        }}
        aria-hidden="true"
      />
      <div className="news-shell news-masthead">
        {listing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#CFC8EE" }}>
              <a href="/" style={{ color: "inherit", textDecoration: "none" }}>首页</a>
              <span style={{ opacity: 0.5 }}> / </span>
              <a href="/news" style={{ color: "inherit", textDecoration: "none" }}>新闻与报告</a>
              <span style={{ opacity: 0.5 }}> / </span>
              {listing.name}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontFamily: T.serif, fontWeight: 900, fontSize: "clamp(30px, 3.6vw, 48px)" }}>
                {listing.name}
              </h1>
              <span style={{ fontFamily: T.mono, fontSize: 13, letterSpacing: "0.18em", color: T.gold }}>
                {listing.en} · {listing.total.toLocaleString("zh-CN")} 篇
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.22em", color: T.gold }}>
              NEWSROOM · {today}
            </span>
            <h1 style={{ margin: 0, fontFamily: T.serif, fontWeight: 900, fontSize: "clamp(30px, 3.6vw, 48px)" }}>
              新闻与报告
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: T.onDark, maxWidth: 720 }}>
              机构公告、调查报告、专题评论、国际声援与三退新闻。全部内容注明来源与日期，可自由转载与翻译。
            </p>
          </div>
        )}
        <a
          href="/search"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: 320,
            padding: "12px 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "#CFC8EE",
            fontSize: 14,
            textDecoration: "none"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CFC8EE" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          {listing ? "在本栏目中搜索" : "搜索文章、人物或地点"}
        </a>
      </div>

      <nav aria-label="新闻分类" className="news-shell news-tabs">
        <a
          href="/news"
          style={{
            fontSize: 15,
            textDecoration: "none",
            padding: "16px 0 14px",
            marginTop: -1,
            whiteSpace: "nowrap",
            color: activeTab ? "#CFC8EE" : "#fff",
            fontWeight: activeTab ? 400 : 600,
            borderTop: `2px solid ${activeTab ? "transparent" : T.gold}`
          }}
        >
          全部
        </a>
        {NEWS_CATEGORIES.map((category) => {
          const on = activeTab === category.slug;
          return (
            <a
              key={category.slug}
              href={`/news/${category.slug}`}
              style={{
                fontSize: 15,
                textDecoration: "none",
                padding: "16px 0 14px",
                marginTop: -1,
                whiteSpace: "nowrap",
                color: on ? "#fff" : "#CFC8EE",
                fontWeight: on ? 600 : 400,
                borderTop: `2px solid ${on ? T.gold : "transparent"}`
              }}
            >
              {category.name}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
