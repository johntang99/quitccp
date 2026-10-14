-- Bound how long a public search can hold a database connection.
--
-- The public search rides on `service_role`, whose statement_timeout is 30s --
-- a ceiling migration 025 raised deliberately, for admin article saves. So a
-- reader's search was governed by a limit meant for the editor's writes.
--
-- Measured 2026-10-14, the three tiers of an article search for 鲍彤 (two
-- Chinese characters, so the trigram indexes from 020 cannot help):
--
--   tier 1  title         155 ms
--   tier 2  summary       323 ms
--   tier 3  body_plain   2438 ms      <- 36 MB of prose, sequential
--
-- Only the body tier is expensive, and only on this table: cms_videos holds
-- 1.5 MB of prose (217 ms) and cms_materials 1 KB (95 ms). So this wraps
-- exactly one tier of one table, and nothing else changes.
--
-- Why it has to be done in the database. Measured: aborting the HTTP request
-- from the application does NOT cancel the query. A request abandoned at
-- 600 ms left the scan running in Postgres until it finished on its own near
-- 2 s. An application-side deadline frees the Vercel function and keeps
-- holding the connection -- and the connection is the scarce thing, there are
-- 60 of them.
--
-- `SET statement_timeout` on the function is hoisted into the transaction by
-- PostgREST, which is what makes it take effect at all; see the note on
-- language below. Verified end to end through the REST path by temporarily
-- setting this function to 100ms: the 2.1s scan came back 57014 in 267ms.
--
-- When the ceiling is hit Postgres raises 57014 and the search degrades: the
-- title and summary tiers have usually found something already, and those
-- results stand while the page says the search was cut short. See
-- `lib/search-substring.ts`; before 239b545 that path was unreachable.
--
-- Verified through the application, with this function pinned to 100ms so the
-- scan could not finish: 「鲍彤 中央」 came back in 1.1s with the 6 results the
-- cheap tiers had found and truncated = true. No exception, no error page.
--
-- ## Why five seconds
--
-- It is a per-statement limit, and this is the one statement it covers, so the
-- number only has to clear the slowest legitimate body scan. Measured, that
-- statement alone (three concurrent, worst of several runs):
--
--   鲍彤                  1980 ms
--   江泽民 密件 批示         2480 ms
--   退党 公证 律师 声明       2481 ms
--   worst seen            2852 ms
--
-- So 5s is about 1.75x the worst real scan: slack enough that a legitimate
-- search is not cut off when the database is busy, tight enough to matter.
--
-- Note what it does not bound. A search issues nine statements -- three tiers
-- across articles, videos and materials -- and only this one carries the
-- limit; the rest still inherit the role's 30s. That is deliberate rather than
-- tidy: the other eight are bounded by how little data they touch (cms_videos
-- 1.5 MB, cms_materials 1 KB, and the title and summary columns of this table
-- are 155-323 ms), so a limit on them would be ceremony. An end-to-end search
-- measured 5.4s in the worst case above, and that is nine statements plus nine
-- round trips, not one query running long.

-- ## Why the signature is four arrays and not one jsonb
--
-- The first attempt took `jsonb` and expressed "every term present, in any of
-- its forms" as a correlated subquery over `jsonb_array_elements`. It was
-- correct -- results matched the filter it replaced exactly, ordering included
-- -- and it was a disaster for speed, because the planner cannot see through
-- that structure to the trigram index:
--
--   「铁证如山」 (4 chars, indexable)   old filter 19.5 ms   jsonb version 1935 ms
--
-- 99x slower on precisely the queries that used to be fast. Measured shapes:
--
--   body_plain ilike $1                           index    15.4 ms
--   body_plain ilike any($1::text[])              index    14.7 ms
--   ($1 is null or ilike any($1))                 index    15.4 ms   <- this one
--   ilike any(array(select jsonb_array_elements_text($1->0)))      1831 ms
--
-- So each term is its own array parameter, OR-ed across its forms by `any()`,
-- AND-ed across terms by separate predicates, with a null guard for the unused
-- slots. Four slots because a reader typing five distinct words is vanishingly
-- rare, and the caller falls back to the ordinary filter beyond that -- losing
-- the timeout for that one query rather than losing the index for all of them.
--
-- A two-character term is 2.1s either way: a trigram index needs three
-- characters. That is the cost this timeout exists to bound, not to remove.

-- ## Why plpgsql, and why the body is a string
--
-- This is the part that is easy to get wrong, and the second attempt did.
--
-- A `language sql` function whose body is a plain SELECT is *inlined* into the
-- calling query, which is why it would normally keep the index. But a function
-- carrying a `SET` clause cannot be inlined -- the setting has to be installed
-- around the call, so the call has to survive as a call. Not inlined means the
-- body is planned once, generically, with the parameters unknown; and a
-- generic plan cannot see that `p_t1` holds `%铁证如山%`, so it cannot use a
-- trigram index on it. Measured, same predicate three ways:
--
--   written directly in the query                      118 ms
--   language sql function WITH set statement_timeout   2026 ms
--   language sql function WITHOUT the set clause        117 ms
--
-- So in that form the timeout and the index were mutually exclusive: the one
-- thing that bounds the slow queries was also a 17x tax on the fast ones.
--
-- `plpgsql` resolves it. It is never inlined either, but `EXECUTE ... USING`
-- plans its query on each call as a one-shot plan, with the actual parameter
-- values available to the planner -- so the index comes back, while the SET
-- clause still does its job:
--
--   written directly in the query                      138 ms
--   plpgsql + EXECUTE USING                            192 ms
--
-- Hence a quoted body and `USING` rather than a static SELECT. The parameters
-- are still parameters, passed by `USING` and never interpolated, so the
-- dynamic SQL adds no injection surface: there is no user text in the string.

drop function if exists public.search_articles_body(jsonb, text, int);
drop function if exists public.search_articles_body(text[], text[], text[], text[], text, int);

create or replace function public.search_articles_body(
  -- One array per term, holding every form that term could take. Patterns
  -- arrive ready for LIKE, escaped by `needlesFor` in search-substring.ts.
  p_t1 text[],
  p_t2 text[],
  p_t3 text[],
  p_t4 text[],
  p_locale text,
  p_limit int
)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  published_at timestamptz,
  hero_image text
)
language plpgsql
stable
-- The whole point of this migration.
set statement_timeout = '5s'
as $fn$
begin
  -- Quoted and EXECUTE'd so each call gets a one-shot plan that can see the
  -- patterns, and therefore the trigram index. See the note above; a static
  -- SELECT here is 17x slower on any query the index could have served.
  return query execute
    'select a.id, a.slug, a.title, a.summary, a.published_at, a.hero_image
       from public.cms_articles a
      where a.status = ''published''
        and a.locale = $1
        and ($2::text[] is null or a.body_plain ilike any($2::text[]))
        and ($3::text[] is null or a.body_plain ilike any($3::text[]))
        and ($4::text[] is null or a.body_plain ilike any($4::text[]))
        and ($5::text[] is null or a.body_plain ilike any($5::text[]))
      order by a.published_at desc nulls last
      limit $6'
    using p_locale, p_t1, p_t2, p_t3, p_t4, p_limit;
end
$fn$;

-- Only the server's key may call it. The publishable key must not be able to
-- start a five-second sequential scan.
revoke all on function public.search_articles_body(text[], text[], text[], text[], text, int)
  from public, anon, authenticated;
grant execute on function public.search_articles_body(text[], text[], text[], text[], text, int)
  to service_role;

notify pgrst, 'reload schema';
