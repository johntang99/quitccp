import { NEWS_CATEGORIES } from "@/lib/public-content";
import { T } from "./newsTokens";

/**
 * The masthead, with the category row sitting inside it on the gradient.
 *
 * The design runs the tabs along the bottom of the header and leaves 72px of
 * gradient below them, so the hero card can lift up over the join.
 */
export function NewsHeader({ active, today }: { active?: string; today: string }) {
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
          搜索文章、人物或地点
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
            color: active ? "#CFC8EE" : "#fff",
            fontWeight: active ? 400 : 600,
            borderTop: `2px solid ${active ? "transparent" : T.gold}`
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
