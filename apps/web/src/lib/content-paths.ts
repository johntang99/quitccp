/**
 * Maps a CMS content entry path to the public route(s) it renders.
 *
 * Used to invalidate the right cached page when an editor saves. Without this
 * a statically-rendered page (the homepage, notably) keeps serving the HTML
 * baked at build time and the edit only appears after a redeploy.
 */
export function contentPathToRoutes(contentPath: string): string[] {
  const path = contentPath.trim();

  // Site-wide entries affect every page's chrome.
  if (["header.json", "footer.json", "navigation.json", "site.json", "theme.json", "seo.json"].includes(path)) {
    return ["/", "/layout"];
  }

  if (!path.startsWith("pages/") || !path.endsWith(".json")) return [];

  const name = path.slice("pages/".length, -".json".length);
  if (name === "home") return ["/"];
  // The article template renders every /news/<slug>, so there is no single
  // route to target.
  if (name === "news-article") return ["/news"];

  const split = name.indexOf("-");
  if (split <= 0) return [`/${name}`];

  const section = name.slice(0, split);
  const slug = name.slice(split + 1);
  return slug === "index" ? [`/${section}`] : [`/${section}/${slug}`];
}
