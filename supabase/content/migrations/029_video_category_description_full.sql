-- The whole sentence now comes from the editor, including the reuse line.
--
-- 028 made the description editable but kept 「全部节目可自由下载、转载与再制作。」
-- appended in code, on the reasoning that a claim true of all 13 pages should
-- not be retyped 13 times. The owner's decision, 2026-10-16: every word on the
-- page comes from the people who write the words, including that one.
--
-- The cost of the change is real and was weighed: the reuse line now lives in
-- 13 rows, so a change to it is 13 edits rather than one. The benefit is that
-- there is no longer a sentence on the page that nobody in the admin can see,
-- reword or remove -- and a line an editor cannot touch is a line that is
-- wrong the day the policy changes.
--
-- This migration preserves what each page renders today, exactly. It is
-- deliberately not a chance to improve the copy: moving the words and changing
-- them in one step would make it impossible to tell afterwards which page
-- changed because of the move and which because somebody edited it.

-- Had their own sentence: fold the reuse line onto the end, matching what the
-- page already shows. The `not like` guard keeps a re-run from doubling it.
update cms_video_categories
   set description = rtrim(description, '。.') || '。全部节目可自由下载、转载与再制作。'
 where description is not null
   and btrim(description) <> ''
   and description not like '%全部节目可自由下载%';

-- Had nothing: the reuse line was the whole of what they showed.
update cms_video_categories
   set description = '全部节目可自由下载、转载与再制作。'
 where description is null or btrim(description) = '';

notify pgrst, 'reload schema';
