import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { listCategories } from "@/lib/admin/repository";

/**
 * Counts for the 文章统计 screen.
 *
 * Every figure is a HEAD count rather than a fetch-and-tally: the map table
 * alone holds 15,513 rows and PostgREST caps a response at 1,000, which is how
 * the category page came to display 0 for a category holding 7,785.
 */
export interface ArticleStats {
  total: number;
  byStatus: { key: string; label: string; count: number }[];
  bySection: { key: string; label: string; count: number }[];
  byCategory: { name: string; slug: string; count: number }[];
  gaps: { key: string; label: string; count: number; href: string }[];
  byYear: { year: string; count: number }[];
}

async function count(build: (q: ReturnType<typeof base>) => ReturnType<typeof base>): Promise<number> {
  const { count: n, error } = await build(base());
  if (error) throw error;
  return n ?? 0;
}

function base() {
  return createSupabaseAdminClient()
    .from("cms_articles")
    .select("id", { count: "exact", head: true });
}

export async function getArticleStats(actorEmail: string): Promise<ArticleStats> {
  const [total, published, draft, archived, news, resources, categories] = await Promise.all([
    count((q) => q),
    count((q) => q.eq("status", "published")),
    count((q) => q.eq("status", "draft")),
    count((q) => q.eq("status", "archived")),
    count((q) => q.eq("section", "news")),
    count((q) => q.eq("section", "resources")),
    listCategories(actorEmail)
  ]);

  const [noCover, noAuthor, noSummary] = await Promise.all([
    count((q) => q.eq("hero_image", "")),
    count((q) => q.eq("author", "")),
    count((q) => q.eq("summary", ""))
  ]);

  // Publication years, for the shape of the archive. One count per year is a
  // handful of cheap queries; pulling 15,000 dates back to group them is not.
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 11 + i);
  const byYear = await Promise.all(
    years.map(async (year) => ({
      year: String(year),
      count: await count((q) =>
        q.gte("published_at", `${year}-01-01T00:00:00Z`).lt("published_at", `${year + 1}-01-01T00:00:00Z`)
      )
    }))
  );

  return {
    total,
    byStatus: [
      { key: "published", label: "已发布", count: published },
      { key: "draft", label: "草稿", count: draft },
      { key: "archived", label: "已归档", count: archived }
    ],
    bySection: [
      { key: "news", label: "新闻", count: news },
      { key: "resources", label: "资料", count: resources }
    ],
    byCategory: categories
      .map((row) => ({ name: row.name, slug: row.slug, count: row.articleCount }))
      .sort((a, b) => b.count - a.count),
    gaps: [
      { key: "no-cover", label: "缺封面图", count: noCover, href: "/admin/articles?gap=no-cover" },
      { key: "no-author", label: "缺作者署名", count: noAuthor, href: "/admin/articles?gap=no-author" },
      { key: "no-summary", label: "缺摘要", count: noSummary, href: "/admin/articles?gap=no-summary" }
    ],
    byYear
  };
}
