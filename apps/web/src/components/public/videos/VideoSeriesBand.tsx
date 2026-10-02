import type { VideoLibraryShelf } from "@/lib/public-content";
import { MONO, Play, SERIF, Still, videoHref } from "./VideoParts";

/**
 * 《九评共产党》 — the series band, as a slow marquee.
 *
 * The track holds the list twice so translating it -50% loops seamlessly; the
 * duplicate is aria-hidden so a screen reader hears each film once. It pauses on
 * hover and does not animate at all for anyone who has asked for reduced motion.
 */
export function VideoSeriesBand({ shelf }: { shelf: VideoLibraryShelf }) {
  if (shelf.videos.length === 0) return null;
  const loop = [...shelf.videos, ...shelf.videos];

  return (
    <section className="vp-series">
      <span
        style={{
          position: "absolute",
          left: -160,
          top: -240,
          width: 700,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(242,211,138,0.28), rgba(242,211,138,0) 100%)"
        }}
        aria-hidden="true"
      />
      <div
        className="vp-shell"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 30, flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 500, fontSize: 13, letterSpacing: "0.08em", color: "var(--gold-lt)" }}>
            SERIES · {shelf.name} · 共 {shelf.total} 集
          </span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(28px, 3.2vw, 44px)", color: "#fff" }}>
            《九评共产党》
          </span>
          <span style={{ fontSize: 15, color: "var(--cream-text)", maxWidth: 720 }}>
            九篇评论，九部影片。系列另含《魔鬼在统治着我们的世界》《共产主义的终极目的》视频版与播报版。
          </span>
        </div>
        {/* The series page, not the oldest film on this shelf: only nine of the
            42 are loaded here, so "the first" is not ours to point at. */}
        <a
          href={`/videos/${shelf.slug}`}
          style={{
            flexShrink: 0,
            background: "var(--gold-lt)",
            color: "var(--on-gold)",
            fontSize: 15,
            fontWeight: 500,
            textDecoration: "none",
            padding: "13px 24px",
            borderRadius: 4
          }}
        >
          从第一评开始观看 →
        </a>
      </div>

      <div className="vp-marquee">
        <div className="vp-track">
          {loop.map((card, index) => (
            <a
              key={`${card.slug}-${index}`}
              href={videoHref(card.slug)}
              aria-hidden={index >= shelf.videos.length}
              tabIndex={index >= shelf.videos.length ? -1 : undefined}
              style={{
                flexShrink: 0,
                width: 330,
                display: "flex",
                flexDirection: "column",
                background: "rgba(16,13,42,0.55)",
                border: "1px solid rgba(242,211,138,0.2)",
                borderRadius: 12,
                overflow: "hidden",
                color: "#fff",
                textDecoration: "none"
              }}
            >
              <Still card={card} radius={0}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(20,14,8,0) 50%, rgba(20,14,8,0.7) 100%)"
                  }}
                  aria-hidden="true"
                />
                {card.episode ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      top: 12,
                      fontFamily: SERIF,
                      fontWeight: 700,
                      fontSize: 15,
                      color: "var(--on-gold)",
                      background: "var(--gold-lt)",
                      padding: "4px 10px",
                      borderRadius: 3
                    }}
                  >
                    {card.episode}
                  </span>
                ) : null}
                <span style={{ position: "absolute", right: 12, bottom: 12 }}>
                  <Play size={38} />
                </span>
              </Still>
              <span style={{ display: "flex", flexDirection: "column", gap: 6, padding: "16px 18px 18px" }}>
                <span style={{ fontSize: 13, color: "var(--cream-text)" }}>{shelf.name} · 视频版</span>
                <span
                  style={{
                    fontFamily: SERIF,
                    fontWeight: 700,
                    fontSize: 19,
                    lineHeight: 1.45,
                    minHeight: 55,
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
