import { notFound, permanentRedirect } from "next/navigation";
import { findSlugRedirect, publicPath } from "@/lib/slug-redirects";
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

/**
 * A content page renders in about a second. Without this it inherits Vercel's
 * 300-second ceiling, and on 2026-10-13 that ceiling is what turned a flood
 * into an outage: ~500 req/s against one article saturated Postgres, every
 * request then blocked on a query it would never get, and each one held its
 * database connection for the full five minutes. The connections never came
 * back fast enough to drain, Postgres stopped accepting new ones, and the
 * whole project went dark -- 86,000 FUNCTION_INVOCATION_TIMEOUTs in 12 hours.
 *
 * Fifteen seconds is far more than this page needs and far less than it takes
 * to exhaust the database. Under load the site now gets slow and sheds
 * requests instead of holding them until something breaks.
 */
export const maxDuration = 15;


interface ResourcesPageProps {
  params: Promise<{ slug?: string[] }>;
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

export const revalidate = 300;

/**
 * Empty on purpose: a dynamic segment with no `generateStaticParams` is treated
 * as fully dynamic and answers `no-store`, whatever `revalidate` says. Measured
 * on /news/[slug].
 */
export async function generateStaticParams() {
  return [];
}

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const resolved = await params;
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
      if (!material) {
        const moved = await findSlugRedirect(
          publicPath.material(decodeURIComponent(categorySlug), decodeURIComponent(materialSlug))
        );
        if (moved) permanentRedirect(encodeURI(moved));
        notFound();
      }
      return <MaterialDetailPage material={material} />;
    }

    /* Same reason as the material slug: the segment is percent-encoded, so a
       category slug with Chinese in it would never match either. None has one
       today, but the comparison should not be the thing that stops it. */
    const decodedCategory = (() => {
      try {
        return decodeURIComponent(categorySlug);
      } catch {
        return categorySlug;
      }
    })();
    const categories = await getMaterialCategories();
    const category = categories.find((row) => row.slug === decodedCategory);
    if (!category) notFound();
    const materials = await getMaterialsByCategory(category.slug);
    return <MaterialCategoryPage category={category} materials={materials} />;
  }

  /* 中华传统文化 has moved to /resources/culture/page.tsx: it is the only page
     here that reads the query string, and reading it kept this whole section
     out of the cache. */

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
    return <PageFromRoute section="resources" slug={slug} />;
  }

  const article = await getRenderableArticle(slug);
  /*
   * 查不到就再按 /news/ 的形式查一次改名记录，而不是直接 404。
   *
   * 这 379 篇的地址在拼音迁移里改了，指向它们的重定向却仍写着旧的中文 slug，
   * 于是 /resources/<中文> 在这里查不到文章 —— 和 /news/[slug] 是同一个坑，
   * 那边 10-12 已经补上（见 0e97f3e），这条分支当时漏了，迁移之后才暴露。
   */
  if (!article) {
    const moved = await findSlugRedirect(publicPath.article(decodeURIComponent(slug)));
    /* Location 头是 latin1，中文地址不先 encodeURI 就交给 permanentRedirect，
       会在 setHeader 里抛 TypeError，读者拿到的是 500 而不是跳转。 */
    if (moved) permanentRedirect(encodeURI(moved));
    notFound();
  }
  return <TemplateRenderer {...article} />;
}
