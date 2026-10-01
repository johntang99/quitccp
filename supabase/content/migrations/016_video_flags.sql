-- The same two editorial flags videos already needed: 重要 and 精彩保留.
--
-- 015 gave these to cms_articles. Videos are edited by the same people, in a
-- form that is otherwise the article form, and they curate them the same way:
-- a small current selection for the section front, and a longer-lived set worth
-- keeping in front of readers after the news has moved on.
--
-- Independent booleans rather than one status column, for the same reason as
-- 015: a video can be both, either or neither.
--
-- Partial indexes, again because the lists that matter ask for the handful that
-- are flagged and never the 745 that are not.

alter table cms_videos
  add column if not exists featured       boolean not null default false,
  add column if not exists editor_archive boolean not null default false;

create index if not exists idx_cms_videos_featured
  on cms_videos (published_at desc nulls last) where featured;

create index if not exists idx_cms_videos_editor_archive
  on cms_videos (published_at desc nulls last) where editor_archive;
