import { notFound } from "next/navigation";
import { NewsListingPage } from "@/components/public/news/NewsListingPage";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { getNewsListing, getRenderableArticle } from "@/lib/public-content";

/**
 * /news/<something> is either a category listing or an article.
 *
 * Category first: those slugs are latin and fixed, article slugs are the
 * Chinese title (now date-prefixed), so the two cannot collide. The old menu
 * slugs -- announcements, investigations, commentary and the rest -- pointed at
 * CMS pages that the real categories replace.
 */
export default async function NewsSlugPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const page = Number((await searchParams).page ?? "1") || 1;

  const listing = await getNewsListing(slug, page);
  if (listing) return <NewsListingPage listing={listing} />;

  const article = await getRenderableArticle(slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
