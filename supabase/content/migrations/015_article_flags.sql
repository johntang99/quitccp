-- Two editorial flags: 重要 and 精彩保留.
--
-- 重要 (featured) marks a piece for the places that show a small, current
-- selection -- the homepage band, the top of a section. 精彩保留
-- (editor_archive) marks one worth keeping in front of readers long after it
-- stops being news. They are independent: an article can be both, either or
-- neither, which is why this is two booleans rather than one status column.
--
-- Partial indexes rather than plain ones: the lists that matter ask for the
-- small set that is flagged, never the large set that is not, and a partial
-- index over 15,515 rows stays tiny.

alter table cms_articles
  add column if not exists featured       boolean not null default false,
  add column if not exists editor_archive boolean not null default false;

create index if not exists idx_cms_articles_featured
  on cms_articles (published_at desc nulls last) where featured;

create index if not exists idx_cms_articles_editor_archive
  on cms_articles (published_at desc nulls last) where editor_archive;
