/**
 * The organisation's sites, by language.
 *
 * Taken from the language dropdown on tuidang.org, which is the authority: these
 * are separate sites run on separate systems, not locales of this one, so the
 * addresses have to be read off the real thing rather than assumed. Each was
 * loaded and confirmed to answer before being listed here (2026-10-04).
 *
 * German is no longer listed. It had no site behind it -- it is not in
 * tuidang.org's dropdown and de.tuidang.org does not resolve -- so it sat in
 * the switcher marked 即将推出. In a dropdown that is worse than in a row of
 * links: an entry that cannot be chosen is a dead option the reader has to
 * read past every time. It comes back when there is a site to point it at.
 */
export interface SiteLanguage {
  /** Stable key for the list; not shown to the reader. */
  code: string;
  /** What the switcher shows. */
  label: string;
  /** The site, or null for the one the reader is already on. */
  href: string | null;
  /** True for the site the reader is already on. */
  current?: boolean;
}

export const SITE_LANGUAGES: readonly SiteLanguage[] = [
  {
    code: "zh",
    label: "中文",
    href: null,
    current: true
  },
  {
    code: "en",
    label: "English",
    href: "https://global.tuidang.org/"
  },
  {
    code: "ko",
    label: "한국어",
    href: "https://kr.tuidang.org/"
  },
  {
    code: "ja",
    label: "日本語",
    href: "https://www.quitccp.jp/"
  },
  {
    code: "ro",
    label: "Română",
    href: "https://ro.tuidang.org/"
  }
];

/**
 * The organisation's social accounts.
 *
 * Taken from tuidang.org, which is where these are actually published, and each
 * loaded to confirm it is the right account (2026-10-04). Before this they were
 * all `href="#"` on every page of the site -- a reader clicking the Facebook
 * icon stayed where they were, which reads as broken rather than unfinished.
 *
 * Telegram is deliberately absent. The icon was in the prototype, tuidang.org
 * has no Telegram link, and the owner confirmed there is no account: an icon for
 * a channel that does not exist is a promise the organisation cannot keep.
 */
export interface SiteSocial {
  label: string;
  href: string;
}

export const SITE_SOCIALS: readonly SiteSocial[] = [
  { label: "Facebook", href: "https://www.facebook.com/tuidang99/" },
  { label: "X", href: "https://x.com/quitccp1" },
  { label: "YouTube", href: "https://www.youtube.com/channel/UC1vENGNAdWWW399VYKWqxuQ" }
];
