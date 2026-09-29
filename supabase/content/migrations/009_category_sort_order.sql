-- Editable display order for article categories.
--
-- Categories were listed alphabetically by name, which is meaningless once the
-- names are Chinese: the editorial order (what matters most first) has nothing
-- to do with stroke or pinyin order. `sort_order` carries that order, with the
-- name as the tie-break so equal values stay stable.

alter table cms_article_categories
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_cms_article_categories_sort
  on cms_article_categories (sort_order, name);
