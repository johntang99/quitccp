-- Indexes for the substring search backend.
--
-- Search runs `ILIKE '%…%'` because Postgres cannot segment Chinese: pg_trgm
-- scores by three-character windows built for Latin words, and measured against
-- this database it returned zero results for 法轮功 while 410 published articles
-- carried it in the title. A substring either matches or it does not, which is
-- the behaviour Chinese actually needs.
--
-- A leading-wildcard ILIKE cannot use a btree index, but it can use a GIN
-- trigram index, so these are worth having for the body scan -- the one tier
-- that reads the full text, around 2.3s unindexed across 15,515 articles.
--
-- Known limit, stated plainly: Postgres can only use a trigram index for
-- patterns of three characters or more. Two-character queries -- 疫情, 香港,
-- 退党, 三退, 中共, all common -- will still sequentially scan. That is inherent
-- to trigram indexing, not something these indexes can fix. They help the long
-- queries; the short ones stay fast only because the title and summary tiers
-- usually answer them before the body tier runs at all.

create extension if not exists pg_trgm;

-- Title and summary are the tiers that answer most searches; they are small
-- enough to scan quickly, but the index keeps them quick as the archive grows.
create index if not exists idx_cms_articles_title_trgm
  on cms_articles using gin (title gin_trgm_ops);
create index if not exists idx_cms_articles_summary_trgm
  on cms_articles using gin (summary gin_trgm_ops);

-- The expensive one. Only reached when title and summary found nothing.
create index if not exists idx_cms_articles_body_trgm
  on cms_articles using gin (body_plain gin_trgm_ops);

-- Videos: 745 rows, cheap either way, indexed for consistency.
create index if not exists idx_cms_videos_title_trgm
  on cms_videos using gin (title gin_trgm_ops);
create index if not exists idx_cms_videos_description_trgm
  on cms_videos using gin (description gin_trgm_ops);

-- Materials are 21 rows; an index there would cost more to maintain than the
-- scan it saves, so they are deliberately left alone.
