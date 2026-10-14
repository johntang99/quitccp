/**
 * The cache tag for the site chrome: theme, top menu, section tab labels.
 *
 * These three are read by the root layout, so every dynamic render paid three
 * database queries for them -- `/search`, `/about/network`, `/resources/culture`,
 * `/services/faq`, both pagination routes, and every ISR regeneration. Measured
 * on an invented `/news/a/<id>`: three queries per request, for a page that was
 * about to 404.
 *
 * They change when an editor changes them, which is rarely, so they are cached
 * across requests and dropped by tag when that happens. Caching them was only
 * safe once every save route cleared its own caches (2026-10-14); before that
 * it would have meant an editor waiting to see their own menu change, which is
 * a worse bug than the one it fixes.
 *
 * ## The rule for anything cached under this tag
 *
 * Cache the answer, never the failure. Each of these loaders used to swallow a
 * database error and return its built-in defaults -- fine when it happened per
 * request, actively harmful once cached, because one blip would pin the
 * default theme and the shipped menu labels in place for an hour after the
 * database recovered. So the cached function throws, which stores nothing, and
 * the caller outside the cache catches and falls back.
 */
export const SITE_CHROME_TAG = "site-chrome";

/** Long, because an edit drops the tag rather than waiting this out. */
export const SITE_CHROME_TTL_SECONDS = 3600;
