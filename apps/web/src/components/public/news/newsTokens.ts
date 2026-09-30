/**
 * Design values lifted from the two mockups in docs/prototypes/news/.
 *
 * Kept in one place so the top sections and the category grid cannot drift
 * apart: both were exported from the same artboard and share every colour.
 */
export const T = {
  ink: "#1A1726",
  paper: "#F4F1EA",
  card: "#FFFEFA",
  rule: "#E3DCCE",
  ruleSoft: "#D9D2C4",
  ruleFaint: "#EAE4D8",
  seal: "#3B3190",
  sealDeep: "#281F6E",
  muted: "#6B6578",
  body: "#45404F",
  gold: "#C9A04E",
  divider: "#CFC8BA",
  serif: "'Noto Serif SC', 'Songti SC', serif",
  sans: "'Noto Sans SC', 'PingFang SC', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace"
} as const;

/** The mockup prints dates as 2026-09-30; keep that, not a localised form. */
export function day(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}
