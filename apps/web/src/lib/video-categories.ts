/**
 * The one sentence that is true of every film, and how a category's own
 * sentence is joined to it.
 *
 * This file used to hold the copy as well, in a `NOTES` map keyed by slug --
 * because `cms_video_categories` had no description column. Migration 028 gave
 * it one, so the words now live beside the name an editor was already able to
 * change, and this file keeps only the joining rule.
 *
 * What the old arrangement cost, measured 2026-10-16: of 13 series, 3 had a
 * sentence and 10 did not, including 觉醒之旅 (258 films) and 三退大潮 (202).
 * Nobody had been careless -- the comment here explained that inventing copy
 * for films nobody had watched would read as a description of films nobody
 * checked, which was right. It just left ten pages waiting on a developer for
 * a sentence only an editor could write.
 */

/** True of every film in the library, so it stands on its own. */
export const VIDEO_REUSE_NOTE = "全部节目可自由下载、转载与再制作。";

/**
 * The category lede: its own sentence, then the reuse line.
 *
 * The reuse line is appended rather than typed, because it is the same claim
 * on all 13 pages: asking an editor to repeat it is a way of ending up with
 * twelve versions of it and one page missing it.
 */
export function videoCategoryLede(description: string): string {
  const note = (description ?? "").trim();
  return note ? `${note.replace(/[。.]$/, "")}。${VIDEO_REUSE_NOTE}` : VIDEO_REUSE_NOTE;
}
