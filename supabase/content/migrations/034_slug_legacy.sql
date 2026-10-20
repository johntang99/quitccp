-- 改拼音地址之前，先给每一行留一个退路。
--
-- 16,218 条内容的地址要一次性换掉。`cms_redirects` 能让老地址继续可用，但它
-- 不是用来回退的：真要退，得从跳转表反查出每一条的原地址，而出事的时候没人
-- 想在那种状态下写 join。
--
-- 这一列让回退变成一句话：
--
--   update cms_articles set slug = slug_legacy where slug_legacy is not null;
--
-- 说清楚它能退什么、不能退什么：
--
--   能退 —— slug 本身、这次新增的跳转记录、被改掉目的地的旧跳转、正文里改过
--           的站内链接。都是库里的东西，都推得出来。
--   退不了 —— 改名之后已经被人分享出去的新地址（退回去它们就死了，除非反过来
--             再留一套跳转），以及搜索引擎已经重爬过的索引。
--
-- 所以回退的有效期是「上线后、新地址还没被大量分享出去之前」。
--
-- 跑稳一个月、确认不需要退之后，把这两列删掉：留着一列永远不读的旧数据，
-- 下一个人会以为它有用。

alter table cms_articles add column if not exists slug_legacy text;
alter table cms_videos   add column if not exists slug_legacy text;

comment on column cms_articles.slug_legacy is
  '改拼音地址之前的旧 slug，只为回退用。确认不需要退之后应当删掉这一列。';
comment on column cms_videos.slug_legacy is
  '改拼音地址之前的旧 slug，只为回退用。确认不需要退之后应当删掉这一列。';
