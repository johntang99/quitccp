import { NEWS_CATEGORIES } from "@/lib/public-content";
import { T } from "./newsTokens";

/**
 * The section masthead and its category row.
 *
 * The tabs are NEWS_CATEGORIES in their fixed order, so the row, the grid below
 * and the menus can never disagree about what the section contains.
 */
export function NewsHeader({ active }: { active?: string }) {
  return (
    <>
      <header
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #2A2268 0%, #3B3190 60%, #4B3EA3 100%)",
          color: "#fff"
        }}
      >
        <span
          style={{
            position: "absolute",
            right: -180,
            top: -240,
            width: 720,
            height: 720,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(242,211,138,0.2), rgba(242,211,138,0) 100%)"
          }}
          aria-hidden="true"
        />
        <div className="news-shell news-masthead">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
            <span style={{ fontSize: 13, color: "#CFC8EE" }}>
              <a href="/" style={{ color: "#CFC8EE", textDecoration: "none" }}>首页</a>
              <span style={{ color: "rgba(255,255,255,0.4)" }}> / </span>
              新闻与报告
            </span>
            <h1 style={{ margin: 0, fontFamily: T.serif, fontWeight: 900, fontSize: "clamp(32px, 4vw, 56px)" }}>
              新闻与报告
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.85, color: "#DAD4F2" }}>
              机构公告、调查报告、专题评论、国际声援与三退新闻。全部内容注明来源与日期，可自由转载与翻译。
            </p>
          </div>
          <a
            href="/search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: 340,
              padding: "14px 18px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#CFC8EE",
              fontSize: 15,
              textDecoration: "none"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CFC8EE" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            搜索文章、人物或地点
          </a>
        </div>
      </header>

      <nav aria-label="新闻分类" style={{ background: "#fff", borderBottom: `1px solid ${T.rule}` }}>
        <div className="news-shell news-tabs">
          <a
            href="/news"
            style={{
              fontSize: 15,
              textDecoration: "none",
              padding: "20px 0 18px",
              whiteSpace: "nowrap",
              color: active ? T.muted : T.ink,
              fontWeight: active ? 400 : 600,
              borderBottom: `2px solid ${active ? "transparent" : T.seal}`
            }}
          >
            全部
          </a>
          {NEWS_CATEGORIES.map((category) => {
            const on = active === category.slug;
            return (
              <a
                key={category.slug}
                href={`/news/${category.slug}`}
                style={{
                  fontSize: 15,
                  textDecoration: "none",
                  padding: "20px 0 18px",
                  whiteSpace: "nowrap",
                  color: on ? T.ink : T.muted,
                  fontWeight: on ? 600 : 400,
                  borderBottom: `2px solid ${on ? T.seal : "transparent"}`
                }}
              >
                {category.name}
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
