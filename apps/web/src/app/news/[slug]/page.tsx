import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsListingPage } from "@/components/public/news/NewsListingPage";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import type { NewsSort } from "@/lib/public-content";
import { getNewsListing, getRenderableArticle } from "@/lib/public-content";

/**
 * /news/<something> is either a category listing or an article.
 *
 * Listing first: those slugs are latin and fixed -- the eight categories plus
 * archive / latest / featured / editor-archive -- while article slugs are the
 * Chinese title (now date-prefixed), so the two cannot collide. The old menu
 * slugs -- announcements, investigations, commentary and the rest -- pointed at
 * CMS pages that the real categories replace.
 */
/**
 * Each article's own title, summary and address.
 *
 * Until now every one of the 15,527 pages under /news carried the site's own
 * title and description, because nothing here declared any, and the root
 * layout additionally claimed the homepage as their canonical. To a search
 * engine that reads as fifteen thousand copies of one page.
 *
 * `getRenderableArticle` runs again here, but Next caches a fetch within a
 * single render, so this costs the lookup rather than the whole page.
 */
export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  /* `slug` arrives as it appears in the address -- already percent-encoded for
     a Chinese title -- so the canonical uses it unchanged. Encoding it again
     turned %E4 into %25E4 and pointed every article at a URL that does not
     exist. */
  const { slug } = await params;

  const listing = await getNewsListing(slug, 1, "latest");
  if (listing) {
    return {
      title: listing.name,
      description: `${listing.name}——全球退党服务中心的${listing.total.toLocaleString("zh-CN")}篇报导与资料。`,
      alternates: { canonical: `/news/${slug}` }
    };
  }

  const article = await getRenderableArticle(slug);
  if (!article) return {};
  const content = (article.content ?? {}) as Record<string, unknown>;
  const summary = typeof content.dek === "string" ? content.dek : "";
  return {
    title: article.title,
    description: summary.slice(0, 180) || undefined,
    alternates: { canonical: `/news/${slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: summary.slice(0, 180) || undefined
    }
  };
}

export default async function NewsSlugPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const page = Number(query.page ?? "1") || 1;
  const sort: NewsSort = query.sort === "oldest" ? "oldest" : "latest";

  const listing = await getNewsListing(slug, page, sort);
  if (listing) return <NewsListingPage listing={listing} />;

  const article = await getRenderableArticle(slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
