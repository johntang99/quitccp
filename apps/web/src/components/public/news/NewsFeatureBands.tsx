import type { NewsCategoryBlock } from "@/lib/public-content";
import { T, articleHref, day } from "./newsTokens";

/**
 * 追查国际调查报告 — the reports run as a numbered series, so the design gives
 * them their own band with the newest as a poster and the rest as episodes.
 *
 * The number comes from the title (第三十二集 → 32); an entry without one shows
 * its date instead of an invented number.
 */
export function InvestigationsBand({ block }: { block: NewsCategoryBlock }) {
  if (!block.lead) return null;
  const lead = block.lead;

  return (
    <section className="news-invest">
      <span
        style={{
          position: "absolute",
          right: -120,
          top: -200,
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(242,211,138,0.18), rgba(242,211,138,0) 100%)"
        }}
        aria-hidden="true"
      />
      <a
        href={articleHref(lead.slug)}
        style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, color: "#fff", textDecoration: "none" }}
      >
        <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "var(--band-deep)" }}>
          {lead.image ? (
            <img src={lead.image} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "16 / 9" }} />
          )}
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 64,
              height: 64,
              margin: "-32px 0 0 -32px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.92)",
              color: "var(--pl-menu)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20
            }}
            aria-hidden="true"
          >
            ▶
          </span>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.onDark, flexWrap: "wrap" }}>
          <span style={{ background: T.gold, color: "var(--on-gold)", fontWeight: 500, padding: "3px 9px", borderRadius: 3 }}>
            {lead.episode ? `第 ${lead.episode} 集 · 最新` : "最新"}
          </span>
          <span style={{ fontFamily: T.mono, whiteSpace: "nowrap" }}>{day(lead.publishedAt)}</span>
        </span>
        <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 24, lineHeight: 1.45 }}>{lead.title}</span>
      </a>

      <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 14,
            borderBottom: "1px solid rgba(255,255,255,0.25)",
            gap: 16
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: T.sans, fontWeight: 500, fontSize: 13, letterSpacing: "0.08em", color: T.gold }}>
              INVESTIGATIONS · 特案专辑
            </span>
            <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 26 }}>{block.name}</span>
          </span>
          <a href={`/news/${block.slug}`} style={{ fontSize: 13, color: T.gold, textDecoration: "none", whiteSpace: "nowrap" }}>
            全部集数 →
          </a>
        </div>
        {block.rest.map((item) => (
          <a
            key={item.slug}
            href={articleHref(item.slug)}
            style={{
              display: "grid",
              gridTemplateColumns: "64px minmax(0, 1fr) 20px",
              gap: 16,
              alignItems: "center",
              padding: "16px 0",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              textDecoration: "none"
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              {item.episode ? (
                <>
                  <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 30, color: T.gold }}>{item.episode}</span>
                  <span style={{ fontSize: 13, color: T.onDarkSoft, marginTop: 4 }}>集</span>
                </>
              ) : (
                <span style={{ fontFamily: T.mono, fontSize: 13, color: T.onDarkSoft, whiteSpace: "nowrap" }}>{day(item.publishedAt)}</span>
              )}
            </span>
            <span
              style={{
                fontFamily: T.serif,
                fontWeight: 600,
                fontSize: 17,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}
            >
              {item.title}
            </span>
            <span style={{ color: T.onDarkSoft }} aria-hidden="true">▶</span>
          </a>
        ))}
      </div>
    </section>
  );
}

/**
 * 专题报导与时政评论 — a lead essay beside 评论员专栏.
 *
 * The columnist cards are bylined, which is only possible because the author
 * harvest filled that field; an unattributed piece falls back to the site's own
 * name rather than showing an empty circle.
 */
export function CommentaryBand({ block }: { block: NewsCategoryBlock }) {
  if (!block.lead) return null;
  const lead = block.lead;

  return (
    <section className="news-commentary">
      <a
        href={articleHref(lead.slug)}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 28,
          color: T.ink,
          textDecoration: "none",
          background: T.cardSand
        }}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 22 }}>{block.name}</span>
          <span style={{ fontFamily: T.mono, fontSize: 13, letterSpacing: "0.18em", color: T.seal, whiteSpace: "nowrap" }}>OPINION</span>
        </span>
        <div style={{ borderRadius: 8, overflow: "hidden", background: T.rule, marginTop: 6 }}>
          {lead.image ? (
            <img src={lead.image} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "16 / 9" }} />
          )}
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 13, color: T.mutedSoft, whiteSpace: "nowrap" }}>{day(lead.publishedAt)}</span>
        <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 22, lineHeight: 1.45 }}>{lead.title}</span>
      </a>

      <div style={{ display: "flex", flexDirection: "column", padding: "28px 28px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 12,
            borderBottom: `2px solid ${T.ink}`
          }}
        >
          <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 18 }}>评论员专栏</span>
          <a href={`/news/${block.slug}`} style={{ fontSize: 13, color: T.seal, textDecoration: "none" }}>
            更多 →
          </a>
        </div>
        <div className="news-commentary-cols">
          {block.rest.map((item) => {
            const name = item.author || "全球退党服务中心";
            return (
              <a
                key={item.slug}
                href={articleHref(item.slug)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "22px 0",
                  borderBottom: `1px solid ${T.rule}`,
                  color: T.ink,
                  textDecoration: "none"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: T.seal,
                      color: T.gold,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.serif,
                      fontWeight: 700,
                      fontSize: 15,
                      flexShrink: 0
                    }}
                    aria-hidden="true"
                  >
                    {name.slice(0, 1)}
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      fontSize: 15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 13, color: T.mutedSoft, marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {day(item.publishedAt)}
                  </span>
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
                  {/* The design quotes the headline, but many already carry
                      their own quotation marks -- 「清竹：你以为你是“秦始皇”」
                      came out with four in a row. Quote only what is not
                      already quoted. */}
                  {/[“”"「」『』]/.test(item.title) ? item.title : `“${item.title}”`}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
