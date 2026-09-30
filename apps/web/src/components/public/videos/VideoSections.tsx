import type { PublicVideoCard, VideoLibraryShelf } from "@/lib/public-content";
import { Duration, MONO, Play, SERIF, SectionHead, Still, kicker, runtime, videoHref } from "./VideoParts";

/** The film the page opens with, beside 最新上线. */
export function FeatureBand({
  feature,
  featureCategory,
  upnext,
  shelves
}: {
  feature: PublicVideoCard | null;
  featureCategory: string;
  upnext: PublicVideoCard[];
  shelves: VideoLibraryShelf[];
}) {
  const seriesOf = (card: PublicVideoCard) =>
    shelves.find((shelf) => shelf.videos.some((video) => video.slug === card.slug))?.name ?? "";

  return (
    <section className="vp-shell vp-feature">
      {feature ? (
        <a
          href={videoHref(feature.slug)}
          style={{
            position: "relative",
            display: "block",
            aspectRatio: "16 / 9",
            borderRadius: 14,
            overflow: "hidden",
            color: "#fff",
            textDecoration: "none",
            background: "#241E4A",
            boxShadow: "var(--shadow)"
          }}
        >
          {feature.coverImage ? (
            <img
              src={feature.coverImage}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          <span
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(20,16,50,0) 35%, rgba(20,16,50,0.6) 62%, rgba(20,16,50,0.96) 100%)"
            }}
            aria-hidden="true"
          />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              width: 92,
              height: 92,
              margin: "-46px 0 0 -46px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              color: "#251E5E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              boxShadow: "0 0 0 14px rgba(255,255,255,0.16)"
            }}
            aria-hidden="true"
          >
            ▶
          </span>
          <span
            style={{ position: "absolute", left: 36, right: 36, bottom: 30, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{ background: "#F2D38A", color: "#1A1638", fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 3 }}
              >
                本期推荐
              </span>
              {[featureCategory, feature.episode, runtime(feature.durationSeconds)]
                .filter(Boolean)
                .map((meta) => (
                  <span
                    key={meta}
                    style={{
                      fontSize: 12,
                      color: "#E6E1F8",
                      border: "1px solid rgba(255,255,255,0.3)",
                      padding: "4px 10px",
                      borderRadius: 999
                    }}
                  >
                    {meta}
                  </span>
                ))}
            </span>
            <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: "clamp(22px, 2.6vw, 34px)", lineHeight: 1.35 }}>
              {feature.title}
            </span>
            {feature.description ? (
              <span
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: "#D6D0F2",
                  maxWidth: 680,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}
              >
                {feature.description}
              </span>
            ) : null}
          </span>
        </a>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "20px 20px 8px",
          boxShadow: "var(--shadow)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 12,
            borderBottom: "2px solid var(--title)"
          }}
        >
          <span
            style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SERIF, fontWeight: 900, fontSize: 18, color: "var(--title)" }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#E0B85C", boxShadow: "0 0 0 4px rgba(224,184,92,0.22)" }}
              aria-hidden="true"
            />
            最新上线
          </span>
          <a href="/videos/others" style={{ fontSize: 13, color: "var(--acc)", textDecoration: "none" }}>
            全部 →
          </a>
        </div>
        {upnext.map((card, index) => (
          <a
            key={card.slug}
            href={videoHref(card.slug)}
            style={{
              display: "grid",
              gridTemplateColumns: "116px minmax(0, 1fr)",
              gap: 14,
              alignItems: "center",
              padding: "11px 0",
              borderBottom: index < upnext.length - 1 ? "1px solid var(--rule)" : "none",
              color: "var(--text)",
              textDecoration: "none"
            }}
          >
            <Still card={card} radius={6}>
              <Duration card={card} size={10} />
            </Still>
            <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 11, color: "var(--acc)" }}>{kicker(card, seriesOf(card))}</span>
              <span
                style={{
                  fontFamily: SERIF,
                  fontWeight: 600,
                  fontSize: 15,
                  lineHeight: 1.45,
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
    </section>
  );
}

/** A series shown as one large film beside a 2×2 of the next four. */
export function LeadAndGrid({ shelf, note }: { shelf: VideoLibraryShelf; note?: string }) {
  const [lead, ...rest] = shelf.videos;
  if (!lead) return null;

  return (
    <section className="vp-shell vp-section">
      <SectionHead name={shelf.name} count={shelf.total} note={note} href={`/videos/${shelf.slug}`} more="全部影片 →" />
      <div className="vp-split">
        <a
          href={videoHref(lead.slug)}
          style={{ display: "flex", flexDirection: "column", gap: 12, color: "var(--title)", textDecoration: "none" }}
        >
          <Still card={lead} radius={12}>
            <span style={{ position: "absolute", left: 18, bottom: 18 }}>
              <Play size={56} />
            </span>
            <Duration card={lead} size={12} />
          </Still>
          <span style={{ fontSize: 12, color: "var(--acc)" }}>{kicker(lead, shelf.name)}</span>
          <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 24, lineHeight: 1.45 }}>{lead.title}</span>
        </a>
        <div className="vp-grid-2">
          {rest.slice(0, 4).map((card) => (
            <a
              key={card.slug}
              href={videoHref(card.slug)}
              style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--text)", textDecoration: "none" }}
            >
              <Still card={card}>
                <span style={{ position: "absolute", left: 10, bottom: 10 }}>
                  <Play size={32} />
                </span>
                <Duration card={card} />
              </Still>
              <span style={{ fontSize: 11, color: "var(--acc)" }}>{kicker(card, shelf.name)}</span>
              <span
                style={{
                  fontFamily: SERIF,
                  fontWeight: 600,
                  fontSize: 16,
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
    </section>
  );
}

/** Two panels side by side: a cover lead over a short list. */
export function PanelDuo({ shelves }: { shelves: VideoLibraryShelf[] }) {
  const filled = shelves.filter((shelf) => shelf.videos.length > 0);
  if (filled.length === 0) return null;

  return (
    <section className="vp-shell vp-section">
      <div className="vp-split">
        {filled.map((shelf) => {
          const [lead, ...rest] = shelf.videos;
          return (
            <div key={shelf.slug} className="vp-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 24, color: "var(--title)" }}>{shelf.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--acc)" }}>{shelf.total} 部</span>
                </span>
                <a href={`/videos/${shelf.slug}`} style={{ fontSize: 13, color: "var(--acc)", textDecoration: "none" }}>
                  全部 →
                </a>
              </div>
              <a
                href={videoHref(lead.slug)}
                style={{ position: "relative", display: "block", color: "#fff", textDecoration: "none" }}
              >
                <Still card={lead}>
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, rgba(20,16,50,0) 40%, rgba(20,16,50,0.95) 100%)"
                    }}
                    aria-hidden="true"
                  />
                  <span style={{ position: "absolute", right: 16, top: 16 }}>
                    <Play size={48} />
                  </span>
                  <span
                    style={{ position: "absolute", left: 20, right: 20, bottom: 18, display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <span style={{ fontSize: 12, color: "#F2D38A" }}>
                      {kicker(lead, shelf.name)}
                      {runtime(lead.durationSeconds) ? (
                        <>
                          {" · "}
                          <span style={{ fontFamily: MONO }}>{runtime(lead.durationSeconds)}</span>
                        </>
                      ) : null}
                    </span>
                    <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 21, lineHeight: 1.45 }}>{lead.title}</span>
                  </span>
                </Still>
              </a>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {rest.slice(0, 3).map((card, index, list) => (
                  <a
                    key={card.slug}
                    href={videoHref(card.slug)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "112px minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: index < list.length - 1 ? "1px solid var(--rule)" : "none",
                      color: "var(--text)",
                      textDecoration: "none"
                    }}
                  >
                    <Still card={card} radius={5} />
                    <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.45 }}>{card.title}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--muted)" }}>
                      {runtime(card.durationSeconds)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A short series laid out as four episodes across, under a progress rule. */
export function EpisodeRow({ shelf, note }: { shelf: VideoLibraryShelf; note?: string }) {
  if (shelf.videos.length === 0) return null;
  const shown = shelf.videos.slice(0, 4);
  const progress = shelf.total > 0 ? Math.min(100, Math.round((shown.length / shelf.total) * 100)) : 0;

  return (
    <section className="vp-shell vp-section">
      <SectionHead
        name={shelf.name}
        count={shelf.total}
        unit="集"
        note={note}
        href={`/videos/${shelf.slug}`}
        more={`全部 ${shelf.total} 集 →`}
      />
      <div className="vp-grid-4" style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 0, right: 0, top: -12, height: 2, background: "var(--rule)" }} aria-hidden="true" />
        <span style={{ position: "absolute", left: 0, width: `${progress}%`, top: -12, height: 2, background: "#E0B85C" }} aria-hidden="true" />
        {shown.map((card) => (
          <a
            key={card.slug}
            href={videoHref(card.slug)}
            style={{ display: "flex", flexDirection: "column", gap: 10, color: "var(--text)", textDecoration: "none" }}
          >
            <Still card={card}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: 10,
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#1A1638",
                  background: "#F2D38A",
                  padding: "3px 8px",
                  borderRadius: 3
                }}
              >
                {/* The real episode number, or the date. Numbering by position
                    would label whatever happens to be newest as 第 1 集, which
                    is a claim the data does not make. */}
                {card.episode || (card.publishedAt ?? "").slice(0, 10)}
              </span>
              <Duration card={card} />
            </Still>
            <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 17, lineHeight: 1.5 }}>{card.title}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** Two panels of four thumbnails each. */
export function PanelPairs({ shelves }: { shelves: VideoLibraryShelf[] }) {
  const filled = shelves.filter((shelf) => shelf.videos.length > 0);
  if (filled.length === 0) return null;

  return (
    <section className="vp-shell vp-section">
      <div className="vp-split">
        {filled.map((shelf) => (
          <div key={shelf.slug} className="vp-panel" style={{ gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 24, color: "var(--title)" }}>{shelf.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--acc)" }}>{shelf.total} 部</span>
              </span>
              <a href={`/videos/${shelf.slug}`} style={{ fontSize: 13, color: "var(--acc)", textDecoration: "none" }}>
                全部 →
              </a>
            </div>
            <div className="vp-grid-2" style={{ gap: 16 }}>
              {shelf.videos.slice(0, 4).map((card) => (
                <a
                  key={card.slug}
                  href={videoHref(card.slug)}
                  style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--text)", textDecoration: "none" }}
                >
                  <Still card={card} radius={8}>
                    <Duration card={card} />
                  </Still>
                  <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.45 }}>{card.title}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The closing row: four cards on panel backgrounds. */
export function CardRow({ shelf, note }: { shelf: VideoLibraryShelf; note?: string }) {
  if (shelf.videos.length === 0) return null;
  return (
    <section className="vp-shell vp-section">
      <SectionHead name={shelf.name} note={note} href={`/videos/${shelf.slug}`} more="全部影片 →" />
      <div className="vp-grid-4">
        {shelf.videos.slice(0, 4).map((card) => (
          <a
            key={card.slug}
            href={videoHref(card.slug)}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              color: "var(--text)",
              textDecoration: "none",
              boxShadow: "var(--shadow)"
            }}
          >
            <Still card={card} radius={0}>
              <Duration card={card} />
            </Still>
            <span style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px 16px" }}>
              <span style={{ fontSize: 11, color: "var(--acc)" }}>{kicker(card, shelf.name)}</span>
              <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.45 }}>{card.title}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
