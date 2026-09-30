import type { NewsCard } from "@/lib/public-content";
import { T, day } from "./newsTokens";

const href = (slug: string) => `/news/${encodeURIComponent(slug)}`;

function Kicker({ category, date, size = 14 }: { category: string; date: string | null; size?: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: size }}>
      {category ? <span style={{ color: T.seal, fontWeight: 500 }}>{category}</span> : null}
      {category && date ? (
        <span style={{ width: 1, height: 11, background: T.divider }} aria-hidden="true" />
      ) : null}
      {date ? <span style={{ fontFamily: T.mono, fontSize: size - 1, color: T.muted }}>{date}</span> : null}
    </span>
  );
}

function SectionRule({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {children}
      <span style={{ flexGrow: 1, height: 1, background: T.ink }} aria-hidden="true" />
      {trailing}
    </div>
  );
}

/**
 * 精选报道 — one large story with two beside it.
 *
 * The rotation the design describes needs no state: the three are the newest
 * flagged 重要, so publishing a new one pushes the previous into the upper side
 * slot and that one down, simply by date order.
 */
export function FeaturedBand({ items }: { items: NewsCard[] }) {
  if (items.length === 0) return null;
  const [main, ...side] = items;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <SectionRule
        trailing={
          <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.2em", color: T.muted }}>
            FEATURED
          </span>
        }
      >
        <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 26 }}>精选报道</span>
      </SectionRule>

      <div className="news-featured-grid">
        <a href={href(main.slug)} style={{ display: "flex", flexDirection: "column", gap: 20, color: T.ink, textDecoration: "none" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 11",
              borderRadius: 6,
              overflow: "hidden",
              background: T.rule,
              boxShadow: "0 30px 60px -36px rgba(26,23,38,0.45)"
            }}
          >
            {main.image ? (
              <img src={main.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : null}
            <span
              style={{
                position: "absolute",
                left: 20,
                top: 20,
                background: T.seal,
                color: "#fff",
                fontFamily: T.mono,
                fontSize: 12,
                letterSpacing: "0.18em",
                padding: "7px 12px",
                borderRadius: 3
              }}
            >
              头条
            </span>
          </div>
          <Kicker category={main.category} date={day(main.publishedAt)} />
          <h2 style={{ margin: 0, fontFamily: T.serif, fontWeight: 900, fontSize: 40, lineHeight: 1.35 }}>
            {main.title}
          </h2>
          {main.summary ? (
            <p
              style={{
                margin: 0,
                fontFamily: T.serif,
                fontSize: 17,
                lineHeight: 1.95,
                color: T.body,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}
            >
              {main.summary}
            </p>
          ) : null}
          <span style={{ alignSelf: "flex-start", fontSize: 14, color: T.seal, paddingTop: 4 }}>阅读全文 →</span>
        </a>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {side.map((item, index) => (
            <a
              key={item.slug}
              href={href(item.slug)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                color: T.ink,
                textDecoration: "none",
                paddingBottom: 28,
                borderBottom: index < side.length - 1 ? `1px solid ${T.ruleSoft}` : "none"
              }}
            >
              <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 6, overflow: "hidden", background: T.rule }}>
                {item.image ? (
                  <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : null}
              </div>
              <Kicker category={item.category} date={day(item.publishedAt)} size={13} />
              <span style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 19, lineHeight: 1.55 }}>{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 最新发布 — two columns of dated headlines inside one card. */
export function LatestBand({ items }: { items: NewsCard[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <SectionRule
        trailing={
          <a href="/news/archive" style={{ fontSize: 14, color: T.seal, textDecoration: "none" }}>
            查看全部 →
          </a>
        }
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.serif, fontWeight: 900, fontSize: 26 }}>
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold, boxShadow: `0 0 0 5px rgba(201,160,78,0.2)` }}
            aria-hidden="true"
          />
          最新发布
        </span>
        <span style={{ fontSize: 14, color: T.muted }}>每日更新</span>
      </SectionRule>

      <div
        className="news-latest-grid"
        style={{
          background: T.card,
          border: `1px solid ${T.rule}`,
          borderRadius: 10,
          padding: "12px 40px",
          boxShadow: "0 1px 2px rgba(26,23,38,0.04), 0 18px 40px -30px rgba(26,23,38,0.25)"
        }}
      >
        {items.map((item, index) => (
          <a
            key={item.slug}
            href={href(item.slug)}
            style={{
              display: "grid",
              gridTemplateColumns: "64px minmax(0, 1fr)",
              gap: 20,
              alignItems: "baseline",
              padding: "24px 0",
              borderBottom: index < items.length - 2 ? `1px solid ${T.ruleFaint}` : "none",
              color: T.ink,
              textDecoration: "none"
            }}
          >
            <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>
              {day(item.publishedAt).slice(5)}
            </span>
            <span
              style={{
                fontFamily: T.serif,
                fontWeight: 600,
                fontSize: 20,
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}
            >
              {item.title}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** 精彩保留 — six cards that stay up long after they stop being news. */
export function ArchiveBand({ items }: { items: NewsCard[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 26 }}>精彩保留</span>
          <span style={{ fontSize: 14, color: T.muted }}>值得反复阅读的深度内容，长期置顶</span>
        </span>
        <span style={{ flexGrow: 1, height: 1, background: T.ink, marginBottom: 8 }} aria-hidden="true" />
        <span
          style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.2em", color: T.muted, marginBottom: 2 }}
        >
          EDITOR&apos;S ARCHIVE
        </span>
      </div>

      <div className="news-archive-grid">
        {items.map((item) => (
          <a
            key={item.slug}
            href={href(item.slug)}
            style={{
              display: "flex",
              flexDirection: "column",
              background: T.card,
              border: `1px solid ${T.rule}`,
              borderTop: `2px solid ${T.seal}`,
              borderRadius: 8,
              overflow: "hidden",
              color: T.ink,
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(26,23,38,0.04), 0 18px 40px -26px rgba(26,23,38,0.28)"
            }}
          >
            <div style={{ position: "relative", height: 220, background: T.rule }}>
              {item.image ? (
                <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : null}
              <span
                style={{
                  position: "absolute",
                  right: 14,
                  top: 14,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,254,250,0.92)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                aria-hidden="true"
              >
                <svg width="14" height="16" viewBox="0 0 14 16" fill={T.gold}>
                  <path d="M1 1h12v14l-6-4-6 4z" />
                </svg>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "22px 24px 20px", flexGrow: 1 }}>
              <span style={{ fontSize: 13, color: T.seal, fontWeight: 500 }}>{item.category}</span>
              <span style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 20, lineHeight: 1.55, flexGrow: 1 }}>
                {item.title}
              </span>
              <span
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: T.muted,
                  paddingTop: 14,
                  borderTop: `1px solid ${T.ruleFaint}`
                }}
              >
                <span style={{ fontFamily: T.mono }}>{day(item.publishedAt)}</span>
                <span style={{ color: T.seal }}>阅读 →</span>
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
