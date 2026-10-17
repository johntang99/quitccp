import { revalidatePath } from "next/cache";
import { getNewsListingSlugs } from "@/lib/public-content";

/**
 * Drops the cached copy of every page an article change can alter.
 *
 * Article pages became cacheable on 2026-10-13, which is what stopped a flood
 * from reaching Postgres. The cost of a cache is that something has to clear
 * it, and an article is never on only one page: its headline sits on the
 * homepage, on /news, in its category listing and in archive, and after a save
 * every one of those is wrong until told otherwise. Before this they were left
 * to expire on their own, so an edit took up to five minutes to appear and a
 * deleted article stayed readable for just as long.
 *
 * `revalidatePath` only marks an entry stale, so calling it sixteen times is
 * cheap -- no page is rendered until somebody asks for one.
 *
 * Deliberately not `revalidatePath("/news", "layout")`, which would reach every
 * route beneath it: that discards all 15,374 article caches over one edit, and
 * rebuilding them is exactly the load this change exists to avoid.
 *
 * @param slugs the articles touched -- their own pages. A rename passes both
 *   the old and the new, since the old address must stop answering.
 */
export async function revalidateNews(slugs: Iterable<string> = []) {
  for (const slug of slugs) {
    if (slug) revalidatePath(`/news/${slug}`);
  }

  /* The homepage and the news home both carry the latest headlines. */
  revalidatePath("/");
  revalidatePath("/news");

  /* Every category and virtual listing: an article's own category is the
     obvious one, but 最新发布 and 全部文章 change for any article at all, and a
     category move changes two of them. Telling all twelve is cheaper than
     working out which. */
  /* 异步了，因为「哪些分类有公开页」现在是数据库里的一列而不是本文件里的
     一张表。每个调用点都必须 await —— 漏掉一个不会报错，只会悄悄不清缓存，
     所以这件事靠 grep 核对过，不靠记性。 */
  for (const slug of await getNewsListingSlugs()) {
    revalidatePath(`/news/${slug}`);
  }

  /*
   * Two things a save deliberately does not clear, both because it cannot.
   *
   * `/news/<slug>/chunk/N`, the scroll's chunks, sit in the CDN's time-based
   * cache rather than Next's ISR layer, and `revalidatePath` only reaches the
   * latter. Measured on 2026-10-16: a save moved all four watched pages from
   * HIT to REVALIDATED and left all four chunks on HIT. Adding the chunk
   * paths to this function therefore does nothing -- it was tried, and it is
   * not worth re-adding. Their staleness is bounded by the `s-maxage` the
   * route sets, which is why that number is 30 and not 300.
   *
   * `/news/<slug>/2` and beyond read `searchParams` for the sort toggle,
   * which makes that route dynamic, so Next serves it `no-store` and it is
   * never cached at all. A reader clicking 下一页 always gets a fresh query;
   * there is nothing there to invalidate.
   */
}
