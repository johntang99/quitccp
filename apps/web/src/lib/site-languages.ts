/**
 * The organisation's sites, by language.
 *
 * Taken from the language dropdown on tuidang.org, which is the authority: these
 * are separate sites run on separate systems, not locales of this one, so the
 * addresses have to be read off the real thing rather than assumed. Each was
 * loaded and confirmed to answer before being listed here (2026-10-04).
 *
 * German is the exception. It appears in this site's own switcher but has no
 * site behind it -- it is not in tuidang.org's dropdown and de.tuidang.org does
 * not resolve -- so it is marked 即将推出 rather than linked. A language link
 * that goes nowhere is worse than one that says it is not ready: the reader
 * clicks, lands on an error, and concludes the organisation is broken.
 */
export interface SiteLanguage {
  /** What the switcher shows. */
  label: string;
  /** The site, or null when there is not one yet. */
  href: string | null;
  /** True for the site the reader is already on. */
  current?: boolean;
  /** Shown on hover for a language with no site. */
  note?: string;
}

export const SITE_LANGUAGES: readonly SiteLanguage[] = [
  { label: "中文", href: null, current: true },
  { label: "English", href: "https://global.tuidang.org/" },
  { label: "Deutsch", href: null, note: "德文网站即将推出" },
  { label: "한국어", href: "https://kr.tuidang.org/" },
  { label: "日本語", href: "https://www.quitccp.jp/" },
  { label: "Română", href: "https://ro.tuidang.org/" }
];
