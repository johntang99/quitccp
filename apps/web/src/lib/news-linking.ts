const RESERVED_NEWS_SLUGS = new Set([
  "index",
  "announcements",
  "investigations",
  "commentary",
  "solidarity",
  "stories",
  "notable",
  "article"
]);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function toNewsArticleSlug(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/["'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "article";
}

export function extractNewsSlugFromHref(href: string): string {
  const raw = href.trim();
  if (!raw) return "";

  let pathname = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return "";
    }
  }
  const match = pathname.match(/^\/news\/([^/?#]+)/);
  if (!match) return "";
  const slug = safeDecode(match[1]);
  if (!slug || RESERVED_NEWS_SLUGS.has(slug)) return "";
  return slug;
}

export function resolveNewsArticleHref({
  href,
  slug,
  title
}: {
  href?: string;
  slug?: string;
  title?: string;
}): string {
  const rawHref = (href ?? "").trim();
  const hrefSlug = extractNewsSlugFromHref(rawHref);
  if (hrefSlug) return `/news/${encodeURIComponent(hrefSlug)}`;

  if (rawHref && rawHref !== "#" && rawHref !== "/news/article" && !rawHref.startsWith("/news/")) {
    return rawHref;
  }

  const rawSlug = safeDecode((slug ?? "").trim());
  const slugCandidate =
    rawSlug && !RESERVED_NEWS_SLUGS.has(rawSlug)
      ? rawSlug
      : title?.trim()
        ? toNewsArticleSlug(title)
        : "";
  return slugCandidate ? `/news/${encodeURIComponent(slugCandidate)}` : "/news/article";
}
