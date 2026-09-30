/**
 * Editorial copy for the eight video series.
 *
 * Lives here rather than in `cms_video_categories` because the table has no
 * description column, and rather than inline in the page because the section
 * index and the category pages both need the same sentence -- the homepage
 * carried its own copies, which is how two pages describing the same shelf end
 * up disagreeing.
 *
 * Only the categories whose copy has actually been written appear. The rest
 * resolve to an empty string and their pages show the reuse line alone; a
 * sentence invented here would read as a description of films nobody checked.
 */
const NOTES: Record<string, string> = {
  frontline: "服务点现场、义工纪实与当事人访谈",
  "party-culture": "解析党文化如何进入语言、教育与日常生活",
  jiuping:
    "九篇评论，九部影片。系列另含《魔鬼在统治着我们的世界》《共产主义的终极目的》视频版与播报版。",
  others: "专题访谈、现场纪录与更多节目"
};

/** True of every film in the library, so it stands on its own. */
export const VIDEO_REUSE_NOTE = "全部节目可自由下载、转载与再制作。";

export function videoCategoryNote(slug: string): string {
  return NOTES[slug] ?? "";
}

/** The category lede: its own sentence, then the reuse line. */
export function videoCategoryLede(slug: string): string {
  const note = videoCategoryNote(slug);
  return note ? `${note.replace(/[。.]$/, "")}。${VIDEO_REUSE_NOTE}` : VIDEO_REUSE_NOTE;
}
