import { revalidatePath } from "next/cache";
import { NEWS_MAX_CHUNK } from "@/components/public/news/newsChunks";
import { NEWS_LISTING_SLUGS } from "@/lib/public-content";

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
 * `revalidatePath` only marks an entry stale, so calling it a hundred and
 * sixty-odd times is cheap -- no page is rendered until somebody asks for
 * one, and the calls collapse into one batch before they leave the request.
 *
 * Deliberately not `revalidatePath("/news", "layout")`, which would reach every
 * route beneath it: that discards all 15,374 article caches over one edit, and
 * rebuilding them is exactly the load this change exists to avoid.
 *
 * @param slugs the articles touched -- their own pages. A rename passes both
 *   the old and the new, since the old address must stop answering.
 */
export function revalidateNews(slugs: Iterable<string> = []) {
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
  for (const slug of NEWS_LISTING_SLUGS) {
    revalidatePath(`/news/${slug}`);

    /*
     * And the scroll's chunks, which are cached pages of the same list.
     *
     * Clearing only `/news/<slug>` left the first thirteen rows fresh and
     * everything the reader scrolled to up to five minutes old -- the two
     * halves of one list disagreeing. Publishing made an article go missing
     * from the scroll (row 13 moved to 14, but the stale chunk still started
     * at the old 14); unpublishing made a row appear twice.
     *
     * Chunk 1 is the server-rendered page, which the line above covers, and
     * the chunk route refuses anything below 2, so the loop starts there.
     *
     * 154 paths looks reckless and is not: `revalidatePath` resolves to an
     * implicit cache tag pushed onto one deduplicated array, and Next sends
     * the whole array to the cache in a single call at the end of the request
     * (`executeRevalidates` -> `incrementalCache.revalidateTag(tags)`).
     * Nothing is rendered here either -- a chunk nobody has asked for has no
     * cache entry to clear, and one that does is rebuilt by its next reader.
     */
    for (let chunk = 2; chunk <= NEWS_MAX_CHUNK; chunk++) {
      revalidatePath(`/news/${slug}/chunk/${chunk}`);
    }
  }

  /*
   * `/news/<slug>/2` and beyond are deliberately absent: that route reads
   * `searchParams` for the sort toggle, which makes it dynamic, so Next serves
   * it `no-store` and it is never cached in the first place. There is nothing
   * there to invalidate -- a reader clicking 下一页 always gets a fresh query.
   */
}
