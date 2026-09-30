import type { NewsCategoryBlock } from "@/lib/public-content";
import { T, articleHref, day } from "./newsTokens";

function RestList({ block, topRule }: { block: NewsCategoryBlock; topRule: boolean }) {
  return (
    <>
      {block.rest.map((item, index) => (
        <a
          key={item.slug}
          href={articleHref(item.slug)}
          style={{
            display: "grid",
            gridTemplateColumns: "88px minmax(0, 1fr)",
            gap: 14,
            alignItems: "baseline",
            padding: "12px 0",
            ...(topRule
              ? { borderTop: `1px solid ${T.rule}` }
              : { borderBottom: index < block.rest.length - 1 ? `1px solid ${T.rule}` : "none" }),
            color: T.ink,
            textDecoration: "none"
          }}
        >
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.mutedSoft }}>{day(item.publishedAt)}</span>
          <span
            style={{
              fontFamily: T.serif,
              fontWeight: 600,
              fontSize: 17,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {item.title}
          </span>
        </a>
      ))}
    </>
  );
}

/**
 * A category panel, in the design's two treatments.
 *
 * "text" puts the lead's image beside its headline on a white card; "cover"
 * makes the lead a full-bleed image with the panel's name over it. The design
 * alternates them down the page so eight panels do not read as one long table.
 */
export function NewsCategoryPanel({
  block,
  variant
}: {
  block: NewsCategoryBlock;
  variant: "text" | "cover";
}) {
  if (!block.lead) return null;

  if (variant === "cover") {
    return (
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          background: T.card,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(26,23,38,0.05), 0 24px 50px -34px rgba(26,23,38,0.35)"
        }}
      >
        <a
          href={articleHref(block.lead.slug)}
          style={{ position: "relative", display: "block", aspectRatio: "16 / 9", color: "#fff", textDecoration: "none", background: "#241E4A" }}
        >
          {block.lead.image ? (
            <img
              src={block.lead.image}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          <span
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(23,19,47,0.55) 0%, rgba(23,19,47,0) 30%, rgba(23,19,47,0) 45%, rgba(23,19,47,0.92) 100%)"
            }}
            aria-hidden="true"
          />
          <span
            style={{
              position: "absolute",
              left: 26,
              right: 26,
              top: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12
            }}
          >
            <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 22 }}>{block.name}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.18em", color: T.gold }}>{block.en}</span>
            </span>
            <span style={{ fontSize: 13, color: "#fff" }}>更多 →</span>
          </span>
          <span
            style={{ position: "absolute", left: 26, right: 26, bottom: 20, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.gold }}>{day(block.lead.publishedAt)}</span>
            <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 22, lineHeight: 1.45 }}>{block.lead.title}</span>
          </span>
        </a>
        <div style={{ display: "flex", flexDirection: "column", padding: "6px 26px 10px" }}>
          <RestList block={block} topRule={false} />
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        background: T.card,
        borderRadius: 12,
        padding: "24px 26px 10px",
        boxShadow: "0 1px 2px rgba(26,23,38,0.05), 0 24px 50px -34px rgba(26,23,38,0.35)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: 14,
          marginBottom: 18,
          borderBottom: `2px solid ${T.ink}`,
          gap: 12
        }}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 22 }}>{block.name}</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.18em", color: T.seal }}>{block.en}</span>
        </span>
        <a href={`/news/${block.slug}`} style={{ fontSize: 13, color: T.seal, textDecoration: "none", whiteSpace: "nowrap" }}>
          更多 →
        </a>
      </div>

      <a href={articleHref(block.lead.slug)} className="news-panel-lead">
        <div style={{ borderRadius: 6, overflow: "hidden", background: T.rule }}>
          {block.lead.image ? (
            <img
              src={block.lead.image}
              alt=""
              style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", aspectRatio: "16 / 9" }} />
          )}
        </div>
        <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.mutedSoft }}>{day(block.lead.publishedAt)}</span>
          <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 20, lineHeight: 1.5 }}>{block.lead.title}</span>
        </span>
      </a>

      <RestList block={block} topRule />
    </section>
  );
}
