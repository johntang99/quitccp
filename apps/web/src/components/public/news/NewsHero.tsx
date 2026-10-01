import type { NewsCard } from "@/lib/public-content";
import { T, articleHref, day, shortDay } from "./newsTokens";

/**
 * Says that a card is one of the 重要 selection.
 *
 * All three cards at the top of the hero are articles an editor flagged 重要;
 * nothing on the page said so, so they read as "whatever happens to be newest".
 * The same ★ the admin list uses, so the mark means one thing in both places.
 */
function FeaturedTag({ size = 12 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: size,
        fontWeight: 500,
        color: T.goldDeep,
        whiteSpace: "nowrap"
      }}
      title="编辑标记为「重要」"
    >
      <span aria-hidden="true">★</span>
      重要
    </span>
  );
}

function Kicker({ card, size = 13, featured = false }: { card: NewsCard; size?: number; featured?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: size, flexWrap: "wrap" }}>
      {card.category ? <span style={{ color: T.seal, fontWeight: 500 }}>{card.category}</span> : null}
      {card.category && card.publishedAt ? (
        <span style={{ width: 1, height: 10, background: T.divider }} aria-hidden="true" />
      ) : null}
      <span style={{ fontFamily: T.mono, fontSize: size - 1, color: T.muted }}>{day(card.publishedAt)}</span>
      {featured ? (
        <>
          <span style={{ width: 1, height: 10, background: T.divider }} aria-hidden="true" />
          <FeaturedTag size={size - 1} />
        </>
      ) : null}
    </span>
  );
}

/**
 * The hero: lead story, two runners-up and the latest feed, in one card that
 * lifts over the header's lower edge.
 *
 * 精选 is the three newest flagged 重要 -- publishing a new one moves it into
 * the lead and pushes the previous two along, by date order alone.
 */
export function NewsHero({ featured, latest }: { featured: NewsCard[]; latest: NewsCard[] }) {
  if (featured.length === 0 && latest.length === 0) return null;
  const [lead, ...second] = featured;

  return (
    <div className="news-shell news-hero-lift">
      <div className="news-hero">
        {lead ? (
          <a
            href={articleHref(lead.slug)}
            style={{ display: "flex", flexDirection: "column", gap: 14, padding: 28, color: T.ink, textDecoration: "none" }}
          >
            <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: T.rule }}>
              {lead.image ? (
                <img src={lead.image} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "16 / 9" }} />
              )}
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: 14,
                  background: T.gold,
                  color: "#1A1638",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "5px 10px",
                  borderRadius: 3
                }}
              >
                头条
              </span>
            </div>
            <Kicker card={lead} featured />
            <h2 style={{ margin: 0, fontFamily: T.serif, fontWeight: 900, fontSize: "clamp(24px, 2.4vw, 32px)", lineHeight: 1.38 }}>
              {lead.title}
            </h2>
            {lead.summary ? (
              <p
                style={{
                  margin: 0,
                  fontFamily: T.serif,
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: T.body,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}
              >
                {lead.summary}
              </p>
            ) : null}
            <span style={{ fontSize: 14, color: T.seal }}>阅读全文 →</span>
          </a>
        ) : null}

        <div className="news-hero-second">
          {second.map((card, index) => (
            <a
              key={card.slug}
              href={articleHref(card.slug)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                color: T.ink,
                textDecoration: "none",
                paddingBottom: 20,
                marginBottom: 20,
                borderBottom: index < second.length - 1 ? `1px solid ${T.rule}` : "none"
              }}
            >
              <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 6, overflow: "hidden", background: T.rule }}>
                {card.image ? (
                  <img src={card.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : null}
              </div>
              <Kicker card={card} size={12} featured />
              <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 19, lineHeight: 1.5 }}>{card.title}</span>
            </a>
          ))}
        </div>

        <div className="news-hero-latest">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 14,
              borderBottom: `2px solid ${T.ink}`
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.serif, fontWeight: 900, fontSize: 19 }}>
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: T.goldDeep, boxShadow: "0 0 0 4px rgba(201,160,78,0.22)" }}
                aria-hidden="true"
              />
              最新发布
            </span>
            <a href="/news/archive" style={{ fontSize: 13, color: T.seal, textDecoration: "none" }}>
              全部 →
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", position: "relative", paddingLeft: 18 }}>
            <span
              style={{ position: "absolute", left: 3, top: 18, bottom: 18, width: 1, background: "#DDD6EA" }}
              aria-hidden="true"
            />
            {latest.map((card, index) => (
              <a
                key={card.slug}
                href={articleHref(card.slug)}
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "40px minmax(0, 1fr)",
                  gap: 8,
                  alignItems: "baseline",
                  padding: "8px 0",
                  color: T.ink,
                  textDecoration: "none"
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: -18,
                    top: 15,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: index === 0 ? T.goldDeep : "#DDD6EA"
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.mutedSoft }}>{shortDay(card.publishedAt)}</span>
                <span
                  style={{
                    fontFamily: T.serif,
                    fontWeight: 600,
                    fontSize: 15,
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  {card.title}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
