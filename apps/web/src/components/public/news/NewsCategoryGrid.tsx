import type { NewsCategoryBlock } from "@/lib/public-content";
import { T, day } from "./newsTokens";

const href = (slug: string) => `/news/${encodeURIComponent(slug)}`;

/**
 * 按栏目浏览 — two columns of category blocks, each a lead story over a dated
 * list of the next four.
 *
 * Categories with nothing in them are dropped rather than shown empty: two of
 * the eight (公告与声明, 名人退党) hold no articles yet, and an empty block reads
 * as a broken page rather than an invitation.
 */
export function NewsCategoryGrid({ blocks }: { blocks: NewsCategoryBlock[] }) {
  const filled = blocks.filter((block) => block.lead);
  if (filled.length === 0) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 32 }}>按栏目浏览</span>
        <span style={{ flexGrow: 1, height: 1, background: T.ink }} aria-hidden="true" />
        <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.2em", color: T.muted }}>
          {filled.length} 个栏目
        </span>
      </div>

      <div className="news-cat-grid">
        {filled.map((block) => (
          <section key={block.slug} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingBottom: 14,
                borderBottom: `2px solid ${T.ink}`
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 26 }}>{block.name}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.18em", color: T.seal }}>
                  {block.en}
                </span>
              </span>
              <a href={`/news/${block.slug}`} style={{ fontSize: 14, color: T.seal, textDecoration: "none" }}>
                更多 →
              </a>
            </div>

            {block.lead ? (
              <a
                href={href(block.lead.slug)}
                style={{ display: "flex", flexDirection: "column", gap: 12, color: T.ink, textDecoration: "none" }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: 6,
                    overflow: "hidden",
                    background: T.rule,
                    boxShadow: "0 24px 48px -32px rgba(26,23,38,0.45)"
                  }}
                >
                  {block.lead.image ? (
                    <img
                      src={block.lead.image}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 4 }}>
                  {day(block.lead.publishedAt)}
                </span>
                <span
                  style={{
                    fontFamily: T.serif,
                    fontWeight: 900,
                    fontSize: 24,
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  {block.lead.title}
                </span>
              </a>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column" }}>
              {block.rest.map((item) => (
                <a
                  key={item.slug}
                  href={href(item.slug)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "96px minmax(0, 1fr)",
                    gap: 20,
                    alignItems: "baseline",
                    padding: "20px 0",
                    borderTop: `1px solid ${T.ruleSoft}`,
                    color: T.ink,
                    textDecoration: "none"
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                    {day(item.publishedAt)}
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
        ))}
      </div>
    </section>
  );
}
