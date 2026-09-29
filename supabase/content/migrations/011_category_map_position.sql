-- Which of an article's categories is the primary one.
--
-- `cms_article_category_map` is keyed only on (article_id, category_id), and
-- Postgres returns rows in no guaranteed order, so "the first row is the
-- primary category" was chance. With several categories per article -- which the
-- editor now sets -- the breadcrumb and the admin's 主分类 could each show a
-- different one on different reads.
--
-- position 0 is the primary category; secondaries follow in the order the
-- editor arranged them.

alter table cms_article_category_map
  add column if not exists position smallint not null default 0;

create index if not exists idx_cms_article_category_map_article_position
  on cms_article_category_map (article_id, position);
