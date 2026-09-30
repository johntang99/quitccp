/**
 * Design values from docs/prototypes/news/news-home-2-html (the Premium
 * artboard), with the earlier two mockups' values where they agree.
 *
 * One place, so the hero card, the dark archive band and the category panels
 * cannot drift apart -- they were exported from the same artboard.
 */
export const T = {
  ink: "#1A1726",
  inkDeep: "#17132F",
  paper: "#F2EEE6",
  card: "#FFFEFA",
  cardWarm: "#FAF7F1",
  cardSand: "#F7F3EC",
  rule: "#ECE6DA",
  ruleSoft: "#D9D2C4",
  seal: "#3B3190",
  sealDeep: "#281F6E",
  gold: "#F2D38A",
  goldDeep: "#C9A04E",
  muted: "#6B6578",
  mutedSoft: "#8A8398",
  body: "#4A4458",
  onDark: "#D6D0F2",
  onDarkSoft: "#B7B0D6",
  divider: "#CFC8BA",
  serif: "'Noto Serif SC', 'Songti SC', serif",
  sans: "'Noto Sans SC', 'PingFang SC', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace"
} as const;

export function day(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

/** 09-29 — the compact form the hero's timeline uses. */
export function shortDay(value: string | null): string {
  return value ? value.slice(5, 10) : "";
}

export const articleHref = (slug: string) => `/news/${encodeURIComponent(slug)}`;
