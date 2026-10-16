-- A description an editor can write, beside the name they can already edit.
--
-- The name of a video series has always lived here and been editable; the
-- sentence under it lived in `lib/video-categories.ts`, in code. So a title
-- and its subtitle -- one line apart on the page -- were changed in two
-- different places, and only one of them by the people who write the words.
--
-- What that cost, measured 2026-10-16: of 13 series, 3 had a sentence. The
-- other 10 -- including 觉醒之旅 (258 films), 三退大潮 (202) and 希望的路 (98)
-- showed only the line that is true of every film on the site, which says
-- nothing about any of them. The file's own comment explains why nobody fixed
-- it: inventing copy for films nobody had watched would have been worse. That
-- was the right call, and it left ten pages waiting for an editor who had no
-- way in.
--
-- Nullable, and empty is a legitimate state: a series with nothing written yet
-- renders the reuse line alone, exactly as it does today. Adding the column
-- changes no page until somebody types something.

alter table cms_video_categories
  add column if not exists description text;

comment on column cms_video_categories.description is
  '分类页标题下面那句话。留空则只显示「全部节目可自由下载、转载与再制作。」';

-- The three sentences that were in the code, so nothing is lost in the move.
-- `coalesce` rather than a plain set: if this migration is run twice, the
-- second run must not overwrite what an editor has since written.
update cms_video_categories set description = coalesce(description, '服务点现场、义工纪实与当事人访谈')
  where slug = 'frontline';
update cms_video_categories set description = coalesce(description, '解析党文化如何进入语言、教育与日常生活')
  where slug = 'party-culture';
update cms_video_categories set description = coalesce(description, '九篇评论，九部影片。系列另含《魔鬼在统治着我们的世界》《共产主义的终极目的》视频版与播报版。')
  where slug = 'jiuping';

notify pgrst, 'reload schema';
