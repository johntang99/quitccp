import { CulturePage } from "@/components/public/CulturePage";
import { PageFromRoute } from "@/components/PageFromRoute";
import { getCultureListing, getRenderablePage } from "@/lib/public-content";

/**
 * 中华传统文化, the one page under /resources that reads the query string.
 *
 * Its filter and paging come from `?filter=` and `?page=`, and reading those
 * marks a route dynamic -- which, while this lived in the catch-all, meant
 * every page under /resources was rendered fresh, with its database queries, on
 * every request. Moving it here lets the rest be cached. A static segment wins
 * over a catch-all, so the catch-all never sees this address.
 *
 * The body is the branch it replaces, unchanged.
 */
export const dynamic = "force-dynamic";
/* Without this the route inherits Vercel's 300-second default -- the
   condition that held database connections for five minutes each and took
   Postgres down on 2026-10-13. Every DB-touching route needs its own bound. */
export const maxDuration = 15;

export default async function ResourcesCulturePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? "" : value ?? "");
  const filter = first(query.filter) || "all";
  const page = Number(first(query.page)) || 1;
  const [listing, stored] = await Promise.all([
    getCultureListing(filter, page),
    getRenderablePage("resources", "culture")
  ]);
  // Before the sub-categories are seeded there is nothing to show; fall back
  // to the stored page rather than render an empty archive.
  if (listing.total > 0) {
    const content = (stored?.content ?? {}) as Record<string, unknown>;
    const panel = (content.freeUsePanel ?? {}) as Record<string, string>;
    const related = (content.relatedPanel ?? {}) as { title?: string; links?: { label: string; href: string }[] };
    return (
      <CulturePage
        title={typeof content.title === "string" ? content.title : "中华传统文化"}
        subtitle={typeof content.subtitle === "string" ? content.subtitle : ""}
        listing={listing}
        activeFilter={filter}
        freeUse={
          panel.title
            ? {
                title: panel.title,
                body: panel.body ?? "",
                buttonLabel: panel.buttonLabel ?? "",
                buttonHref: panel.buttonHref ?? "/resources/downloads"
              }
            : undefined
        }
        related={related.title ? { title: related.title, links: related.links ?? [] } : undefined}
      />
    );
  }
  return <PageFromRoute section="resources" slug="culture" query={query} />;
}
