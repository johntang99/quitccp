import type { NewsCard } from "@/lib/public-content";
import { T, articleHref, day } from "./newsTokens";

/**
 * 精彩保留 — six cards on the same blue the masthead uses.
 *
 * Photo on top, headline beneath it on a white card, the way .news-cat-lead and
 * .news-cat-row already work elsewhere on this page. The earlier version laid
 * the headline over the photo and needed a heavy dark scrim to stay readable,
 * which meant every image was shown through a filter: these are photographs of
 * people at rallies and press conferences, and dimming them to make room for
 * text is the wrong trade.
 *
 * The card body carries the category and date. They were dropped when the
 * headline still sat over the photograph, where the line competed with the image
 * for the same few readable pixels; on a white card under it there is room, and
 * knowing which section a piece belongs to is worth more than the position
 * number that stood here, which told a reader nothing they needed.
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
            <span style={{ fontFamily: T.mono, fontSize: 13, letterSpacing: "0.24em", color: T.gold, whiteSpace: "nowrap" }}>
              EDITOR&apos;S ARCHIVE
            </span>
            <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: "clamp(26px, 2.8vw, 36px)" }}>精彩保留</span>
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
          {items.map((card) => (
            <a key={card.slug} href={articleHref(card.slug)} className="news-archive-card">
              <span className="news-archive-thumb">
                {card.image ? <img src={card.image} alt="" /> : null}
              </span>
              <span className="news-archive-body">
                {/* Same shape as NewsHero's Kicker -- category in seal, a hairline
                    divider, date in mono -- built from the same tokens rather
                    than imported, because that one also carries the 重要 tag and
                    these cards do not. */}
                <span className="news-archive-meta">
                  {card.category ? (
                    <span style={{ color: T.seal, fontWeight: 500 }}>{card.category}</span>
                  ) : null}
                  {card.category && card.publishedAt ? (
                    <span className="news-archive-sep" aria-hidden="true" />
                  ) : null}
                  {card.publishedAt ? (
                    <span style={{ fontFamily: T.mono, color: T.muted, whiteSpace: "nowrap" }}>
                      {day(card.publishedAt)}
                    </span>
                  ) : null}
                </span>
                <span className="news-archive-title">{card.title}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
