import { revalidatePath } from "next/cache";
import { VIDEO_VIRTUAL_LISTING_SLUGS, listPublicVideoCategories } from "@/lib/public-content";

/**
 * Drops the cached copy of every page a video change can alter.
 *
 * The same reasoning as `revalidateNews`: once a page is cached, something has
 * to clear it, and a video is never on only one page -- it sits on the video
 * home, in its series listing, and in 全部视频.
 *
 * Unlike the news categories, the series are rows in `cms_video_categories`
 * rather than a fixed list in the source, so they are read here. One query per
 * save is cheap next to serving a stale listing; a failure falls back to the
 * pages that are knowable without it, because a save must not fail over a
 * cache.
 *
 * @param slugs the videos touched -- their own pages. A rename passes the old
 *   slug too, since the old address is still a cached page until told.
 */
export async function revalidateVideos(slugs: Iterable<string> = []) {
  for (const slug of slugs) {
    if (slug) revalidatePath(`/videos/${slug}`);
  }

  revalidatePath("/");
  revalidatePath("/videos");
  for (const slug of VIDEO_VIRTUAL_LISTING_SLUGS) revalidatePath(`/videos/${slug}`);

  try {
    for (const row of await listPublicVideoCategories()) {
      if (row.slug) revalidatePath(`/videos/${row.slug}`);
    }
  } catch {
    /* The listings above are already cleared; a series page that keeps its copy
       for the rest of its window is a smaller harm than a refused save. */
  }
}
