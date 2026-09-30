import type { NewsCard } from "@/lib/public-content";
import { T, articleHref, day } from "./newsTokens";

/**
 * 精彩保留 — six full-bleed cards on a near-black band.
 *
 * Numbered in gold, which is what gives the band its rhythm; the number is the
 * position in the set, not anything stored.
 */
export function NewsArchiveBand({ items }: { items: NewsCard[] }) {
  if (items.length === 0) return null;

  return (
    <section className="news-archive-band">
      <span
        style={{
          position: "absolute",
          left: -200,
          bottom: -380,
          width: 900,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(242,211,138,0.16), rgba(242,211,138,0) 100%)"
        }}
        aria-hidden="true"
      />
      <div className="news-shell" style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 32,
            gap: 24,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.24em", color: T.gold }}>
              EDITOR&apos;S ARCHIVE
            </span>
            <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: "clamp(26px, 2.8vw, 36px)" }}>精彩保留</span>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: T.onDarkSoft }}>值得反复阅读的深度内容，长期置顶</span>
            {/* The band shows six; the rest were unreachable until this listing
                existed. */}
            <a href="/news/editor-archive" style={{ fontSize: 14, color: T.gold, textDecoration: "none", whiteSpace: "nowrap" }}>
              全部 →
            </a>
          </span>
        </div>

        <div className="news-archive-grid">
          {items.map((card, index) => (
            <a
              key={card.slug}
              href={articleHref(card.slug)}
              style={{
                position: "relative",
                display: "block",
                aspectRatio: "16 / 9",
                borderRadius: 10,
                overflow: "hidden",
                color: "#fff",
                textDecoration: "none",
                background: "#241E4A",
                boxShadow: "0 30px 60px -30px rgba(0,0,0,0.6)"
              }}
            >
              {card.image ? (
                <img
                  src={card.image}
                  alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(23,19,47,0.15) 0%, rgba(23,19,47,0.35) 40%, rgba(23,19,47,0.95) 100%)"
                }}
                aria-hidden="true"
              />
              <span
                style={{
                  position: "absolute",
                  left: 20,
                  top: 16,
                  fontFamily: T.serif,
                  fontWeight: 900,
                  fontSize: 28,
                  color: T.gold,
                  textShadow: "0 2px 10px rgba(0,0,0,0.4)"
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  position: "absolute",
                  left: 20,
                  right: 20,
                  bottom: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}
              >
                <span style={{ fontSize: 12, color: T.onDark }}>
                  {card.category} · <span style={{ fontFamily: T.mono }}>{day(card.publishedAt)}</span>
                </span>
                <span
                  style={{
                    fontFamily: T.serif,
                    fontWeight: 700,
                    fontSize: 19,
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  {card.title}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
