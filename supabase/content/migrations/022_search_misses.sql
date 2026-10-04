-- What readers searched for and did not find.
--
-- The point is to learn what the archive cannot answer. Every improvement to
-- search so far came from guessing: the 繁體 gap was found by me testing 退黨 on
-- a hunch, and a reader who hit it would simply have concluded the site had
-- nothing on the subject and left. This table is how that stops being a guess.
--
-- Designed narrow, because of who uses this site.
--
-- Readers include people with family inside China, and a stored record of what
-- somebody searched for is a record about a person. So:
--
--   * only searches that returned NOTHING are written. A successful search is
--     never recorded.
--   * no IP address, no user agent, no session, no account, no timestamp per
--     search. One row per distinct phrase, with a counter -- it is a frequency
--     table, not a log, and it cannot be walked back to a visit.
--   * rows expire. The cron deletes anything not seen in 60 days, so the table
--     reflects what is missing now rather than accumulating a history.
--
-- One consequence worth stating plainly: a phrase searched once by one person
-- still appears here with a count of 1. Nothing ties it to them, but the words
-- are kept. Declaration and certificate lookups happen on santui.tuidang.org and
-- service.tuidang.org and are not searchable here at all, so the names people
-- look up are not the kind of thing that lands in this table -- but if that ever
-- changes, this design has to change with it.

create table if not exists cms_search_misses (
  -- The normalised phrase, and the primary key: one row per distinct search, so
  -- recording a repeat is an increment rather than another row.
  query text primary key,
  hits integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- The admin lists the most-searched misses first, and the cron deletes by age.
create index if not exists idx_cms_search_misses_hits on cms_search_misses(hits desc);
create index if not exists idx_cms_search_misses_last_seen on cms_search_misses(last_seen);

-- Increment or insert, in one statement, so two readers searching the same
-- missing phrase at once cannot lose a count or collide on the key.
create or replace function record_search_miss(p_query text)
returns void
language sql
as $$
  insert into cms_search_misses (query, hits, first_seen, last_seen)
  values (p_query, 1, now(), now())
  on conflict (query) do update
    set hits = cms_search_misses.hits + 1,
        last_seen = now();
$$;
