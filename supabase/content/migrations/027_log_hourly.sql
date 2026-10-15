-- One row per hour, summarising what the log archive holds for that hour.
--
-- The raw NDJSON lives in R2 and expires after 14 days, which is the right
-- window for the question it answers: "what exactly was arriving at 03:40 on
-- the 13th". After that the question changes shape. Nobody asks what a single
-- request looked like six weeks ago; they ask whether that week was normal,
-- how this Tuesday compares with last Tuesday, what traffic did either side of
-- the attack. Those are answered by counts, and counts are small enough to
-- keep forever: 24 rows a day, a few hundred bytes each, about 1 MB a decade.
--
-- It is also what makes the logs visible at all. A dashboard that read R2 on
-- every page load would download tens of megabytes to render a number; this
-- table is a single indexed select. The raw lines stay one command away
-- (scripts/read-drain-logs.mjs) for the times somebody genuinely needs them.
--
-- `hour` is the UTC hour the archive is partitioned by, truncated. UTC and not
-- local time because that is how the R2 keys are laid out, and converting
-- silently is how you end up summarising the wrong hour.

create table if not exists cms_log_hourly (
  hour timestamptz primary key,

  -- Request-shaped records: the ones carrying a `proxy` object. Build and
  -- other lines are counted separately rather than mixed in, because a deploy
  -- can produce hundreds of lines in a minute and would otherwise look like a
  -- traffic spike.
  requests integer not null default 0,
  status_2xx integer not null default 0,
  status_3xx integer not null default 0,
  status_4xx integer not null default 0,
  status_5xx integer not null default 0,

  -- Straight from `proxy.vercelCache`. The whole point of the 10-13 hardening
  -- was to move reads onto the CDN, so the share of HIT is the number that
  -- says whether that still holds -- and it is the one that regresses
  -- silently.
  cache_hit integer not null default 0,
  cache_miss integer not null default 0,
  cache_other integer not null default 0,

  -- `level` = error, across every source. Zero is the normal reading.
  errors integer not null default 0,
  -- Everything without a `proxy`: builds, and whatever Vercel adds later.
  other_lines integer not null default 0,

  -- What the hour cost to keep, and how much work it was to roll up.
  batches integer not null default 0,
  bytes bigint not null default 0,

  -- `[{"path": "...", "n": 123}, ...]`, ten at most. High cardinality kept out
  -- of columns on purpose: the interesting part is always the head.
  top_paths jsonb not null default '[]'::jsonb,
  -- Same shape, for `proxy.statusCode`. Keeps 404 storms visible without a
  -- column per code.
  top_status jsonb not null default '[]'::jsonb,

  -- Deliberately absent: anything derived from `proxy.clientIp`. Readers of
  -- this site are overseas Chinese; a permanent, queryable record of who read
  -- what is not a thing to create as a side effect of a traffic chart. The raw
  -- archive carries IPs only while Vercel's IP Address Visibility is on, and
  -- only for the 14 days R2 keeps them.

  updated_at timestamptz not null default now()
);

-- The dashboard asks for the most recent N hours, always.
create index if not exists idx_cms_log_hourly_hour on cms_log_hourly (hour desc);

alter table cms_log_hourly enable row level security;
drop policy if exists cms_log_hourly_no_access on cms_log_hourly;
-- service_role only, like every other operational table here. The publishable
-- key must not be able to read the site's traffic shape.
create policy cms_log_hourly_no_access
  on cms_log_hourly
  for all
  using (false)
  with check (false);

notify pgrst, 'reload schema';
