/**
 * The first image in a Markdown body.
 *
 * Its own module, with no Next.js imports, so the backfill script can use the
 * very same rule the article page uses. When the two were separate the site and
 * the database could disagree about which picture an article leads with.
 *
 * "Hero image" is a recent convention. The older articles predate it: they
 * carry their photographs inline and have no cover field at all, so an empty
 * `hero_image` never meant an article without pictures.
 */
export function firstImageInMarkdown(markdown: string): string {
  if (!markdown) return "";
  const md = markdown.match(/!\[[^\]]*]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/);
  if (md?.[1]) return md[1];
  const html = markdown.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (html?.[1]) return html[1];
  return "";
}
