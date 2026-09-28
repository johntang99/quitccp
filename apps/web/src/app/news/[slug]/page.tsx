import { PageFromRoute } from "@/components/PageFromRoute";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { getRenderableArticle } from "@/lib/public-content";
import { notFound } from "next/navigation";

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const newsMenuSlugs = new Set(["announcements", "investigations", "commentary", "solidarity", "stories", "notable"]);
  if (newsMenuSlugs.has(resolved.slug)) {
    return <PageFromRoute section="news" slug={resolved.slug} />;
  }
  const article = await getRenderableArticle(resolved.slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
