-- Editorial fields the article admin needs.
--
-- Everything here is additive and nullable-or-defaulted, so it is safe to run
-- against the existing 10,000 migrated rows: they simply carry empty values
-- until an editor fills them in.
--
-- `published_at` already exists and is populated for migrated rows; it is the
-- write path that never set it, which is a code fix rather than a migration.

alter table cms_articles
  add column if not exists subtitle        text not null default '',
  add column if not exists hero_image      text not null default '',
  add column if not exists hero_image_alt  text not null default '',
  add column if not exists hero_credit     text not null default '',
  add column if not exists author          text not null default '',
  add column if not exists translator      text not null default '',
  add column if not exists source_title    text not null default '',
  add column if not exists source_url      text not null default '';

-- The article list sorts by these two constantly; without an index that is a
-- sequential scan over 15,000 rows on every page of the admin.
create index if not exists idx_cms_articles_published_at
  on cms_articles (published_at desc nulls last);

create index if not exists idx_cms_articles_updated_at
  on cms_articles (updated_at desc);

-- Data-quality filters in the admin ("missing a cover", "no byline") and the
-- author dropdown both scan these.
create index if not exists idx_cms_articles_author
  on cms_articles (author) where author <> '';
