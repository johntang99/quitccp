/**
 * Design values from docs/prototypes/news/news-home-2-html (the Premium
 * artboard), with the earlier two mockups' values where they agree.
 *
 * One place, so the hero card, the dark archive band and the category panels
 * cannot drift apart -- they were exported from the same artboard.
 */
export const T = {
  ink: "var(--ink-band)",
  inkDeep: "var(--band-deepest)",
  paper: "var(--paper)",
  card: "var(--card)",
  cardWarm: "var(--paper)",
  cardSand: "var(--paper)",
  rule: "var(--rule)",
  ruleSoft: "var(--rule)",
  seal: "var(--seal-bright)",
  sealDeep: "var(--pl-menu)",
  gold: "var(--gold-lt)",
  goldDeep: "var(--gold-muted)",
  muted: "var(--ink-dim)",
  mutedSoft: "var(--lav-dim)",
  body: "var(--ink-mid)",
  onDark: "var(--lav-tint)",
  onDarkSoft: "var(--lav-lt)",
  divider: "var(--cream-rule)",
  serif: "var(--serif)",
  sans: "var(--sans)",
  mono: "var(--mono)"
} as const;

export function day(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

/** 09-29 — the compact form the hero's timeline uses. */
export function shortDay(value: string | null): string {
  return value ? value.slice(5, 10) : "";
}

export const articleHref = (slug: string) => `/news/${encodeURIComponent(slug)}`;
