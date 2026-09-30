import { NewsCategoryGrid } from "@/components/public/news/NewsCategoryGrid";
import { NewsHeader } from "@/components/public/news/NewsHeader";
import { ArchiveBand, FeaturedBand, LatestBand } from "@/components/public/news/NewsTopSections";
import { getNewsHome } from "@/lib/public-content";

export const revalidate = 300;

/**
 * 新闻与报告 landing.
 *
 * Two halves, as designed: the top carries 精选报道 / 最新发布 / 精彩保留 across
 * every category, and below it the eight categories each show their newest
 * five. Built from the articles themselves rather than a CMS page, so it is
 * current without anyone maintaining it.
 */
export default async function NewsIndexPage() {
  const home = await getNewsHome();

  return (
    <div className="news-page">
      <NewsHeader />
      <div className="news-shell news-body">
        <FeaturedBand items={home.featured} />
        <LatestBand items={home.latest} />
        <ArchiveBand items={home.archive} />
        <NewsCategoryGrid blocks={home.categories} />
      </div>
    </div>
  );
}
