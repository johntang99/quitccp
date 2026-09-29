import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { getRenderableArticle } from "@/lib/public-content";

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

  if (!slug || RESOURCE_PAGES.has(slug)) {
    return <PageFromRoute section="resources" slug={slug} query={query} />;
  }

  const article = await getRenderableArticle(slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
