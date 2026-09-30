import type { PublicVideoCard } from "@/lib/public-content";

export const SERIF = "'Noto Serif SC', 'Songti SC', serif";
export const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export const videoHref = (slug: string) => `/videos/${encodeURIComponent(slug)}`;

/** 12:47 — blank when the duration was never recovered, rather than 0:00. */
export function runtime(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** The kicker over a card: its series and episode, whichever exist. */
export function kicker(card: PublicVideoCard, series: string): string {
  return [series, card.episode].filter(Boolean).join(" · ");
}

export function Duration({ card, size = 11 }: { card: PublicVideoCard; size?: number }) {
  const label = runtime(card.durationSeconds);
  if (!label) return null;
  return (
    <span
      style={{
        position: "absolute",
        right: 8,
        bottom: 8,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        fontFamily: MONO,
        fontSize: size,
        padding: "3px 6px",
        borderRadius: 3
      }}
    >
      {label}
    </span>
  );
}

export function Play({ size }: { size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.92)",
        color: "#251E5E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size / 3),
        flexShrink: 0
      }}
      aria-hidden="true"
    >
      ▶
    </span>
  );
}

/** A 16:9 still with whatever sits on top of it. */
export function Still({
  card,
  radius = 10,
  children
}: {
  card: PublicVideoCard;
  radius?: number;
  children?: React.ReactNode;
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "block",
        borderRadius: radius,
        overflow: "hidden",
        background: "#241E4A",
        aspectRatio: "16 / 9"
      }}
    >
      {card.coverImage ? (
        <img
          src={card.coverImage}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      {children}
    </span>
  );
}

/** The header every series section shares. */
export function SectionHead({
  name,
  count,
  unit = "部",
  note,
  href,
  more
}: {
  name: string;
  count?: number;
  unit?: string;
  note?: string;
  href: string;
  more: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: "clamp(22px, 2.4vw, 32px)", color: "var(--title)" }}>
          {name}
        </span>
        {count !== undefined ? (
          <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--acc)" }}>
            {count} {unit}
          </span>
        ) : null}
        {note ? <span style={{ fontSize: 14, color: "var(--muted)" }}>{note}</span> : null}
      </span>
      <a href={href} style={{ fontSize: 14, color: "var(--acc)", textDecoration: "none", whiteSpace: "nowrap" }}>
        {more}
      </a>
    </div>
  );
}
