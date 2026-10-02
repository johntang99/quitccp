import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { CulturePage } from "@/components/public/CulturePage";
import {
  MaterialCategoryPage,
  MaterialDetailPage,
  MaterialsIndexPage
} from "@/components/public/MaterialPages";
import {
  getMaterial,
  getMaterialCategories,
  getCultureListing,
  getMaterialsByCategory,
  getRenderableArticle,
  getRenderablePage
} from "@/lib/public-content";

interface ResourcesPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The CMS pages under /resources. Anything else is treated as an article.
 *
 * 379 migrated articles live in this section -- 中华传统文化 and 资料下载 -- and
 * their redirects point at /resources/<slug>. Without the article branch every
 * one of them 404s, which the redirect map made easy to miss: the 301 resolved
 * and then landed on nothing.
 */
const RESOURCE_PAGES = new Set(["index", "press", "magazine", "culture", "tools", "downloads"]);

export default async function ResourcesPage({ params, searchParams }: ResourcesPageProps) {
  const resolved = await params;
  const query = await searchParams;
  const slug = resolved.slug?.[0];

  /*
   * 真相点资料 has two levels under /resources/downloads, so the deeper segments
   * are handled before the CMS-page branch -- which keys off slug[0] alone and
   * would otherwise render the download index for every path beneath it.
   */
  if (slug === "downloads" && resolved.slug && resolved.slug.length > 1) {
    const [, categorySlug, materialSlug] = resolved.slug;

    if (materialSlug) {
      const material = await getMaterial(materialSlug);
      if (!material) notFound();
      return <MaterialDetailPage material={material} />;
    }

    const categories = await getMaterialCategories();
    const category = categories.find((row) => row.slug === categorySlug);
    if (!category) notFound();
    const materials = await getMaterialsByCategory(category.slug);
    return <MaterialCategoryPage category={category} materials={materials} />;
  }

  if (slug === "culture") {
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
  }

  if (slug === "downloads") {
    const [categories, page] = await Promise.all([
      getMaterialCategories(),
      getRenderablePage("resources", "downloads")
    ]);
    // Before 017 is run there are no categories; fall through to the stored
    // page rather than showing an empty grid.
    if (categories.length > 0) {
      const content = (page?.content ?? {}) as Record<string, unknown>;
      const reuse = (content.reuseNotice ?? {}) as { title?: string; body?: string };
      // Only tiles that actually go somewhere: the stored list still carries
      // three placeholders whose href is "#".
      const links = (Array.isArray(content.assets) ? content.assets : [])
        .map((row) => (typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {}))
        .map((row) => ({
          title: typeof row.title === "string" ? row.title : "",
          body: typeof row.body === "string" ? row.body : "",
          badge: typeof row.badge === "string" ? row.badge : "",
          href: typeof row.href === "string" ? row.href : ""
        }))
        .filter((row) => row.title && row.href && row.href !== "#");
      return (
        <MaterialsIndexPage
          title={typeof content.title === "string" ? content.title : "真相点资料下载"}
          subtitle={typeof content.subtitle === "string" ? content.subtitle : ""}
          categories={categories}
          links={links}
          notice={reuse.title ? { title: reuse.title, body: reuse.body ?? "" } : undefined}
        />
      );
    }
  }

  if (!slug || RESOURCE_PAGES.has(slug)) {
    return <PageFromRoute section="resources" slug={slug} query={query} />;
  }

  const article = await getRenderableArticle(slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
