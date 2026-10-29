-- 访问统计的每日汇总。方案见 docs/implementation/site-analytics-plan.md。
--
-- 每次浏览记在 Cloudflare Workers Analytics Engine，不进这个库：2026-10-13 那次
-- 洪水是几亿次请求打一篇文章，每次阅读都写 Postgres 的计数器等于把门重新打开。
-- 这里只收 /api/cron/stats-rollup 每天一次的汇总，一天几千行。
--
-- Analytics Engine 只保留 3 个月，所以这些表是长期数据的唯一来源，永久保留。
--
-- `day` 是 UTC 日期，和日志汇总一致。不存 IP、不存访客编号：访客数只是当天
-- 去重后的一个数字，见 workers/quitccp-stats/src/index.js。

-- 全站每天一行。访客数必须单独算 —— 各页面访客相加会把看了三篇的人算三次。
create table if not exists cms_stats_daily (
  day date not null,
  locale text not null,
  views integer not null default 0,
  visitors integer not null default 0,
  -- 从站外进来的浏览（不是站内跳转）。来源分析的分母。
  entrances integer not null default 0,
  -- 浏览器里第一次来本站的访客。
  new_visitors integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, locale)
);

-- 每天每个路径一行。文章的长地址 /news/<slug> 和短地址 /a/<code> 各占一行，
-- 用 article_id 归到同一篇；文章改了 slug 也不会断。
create table if not exists cms_stats_daily_pages (
  day date not null,
  locale text not null,
  path text not null,
  -- article / news-listing / home / video / material / page
  kind text not null,
  article_id uuid,
  views integer not null default 0,
  visitors integer not null default 0,
  primary key (day, locale, path)
);
create index if not exists idx_cms_stats_pages_article
  on cms_stats_daily_pages (locale, article_id, day) where article_id is not null;

-- 每天每个维度值一行。dim:
--   source_type  进站来源类别：search / social / referral / direct / campaign
--   source_host  进站来源网站
--   utm          utm_source
--   country / region / city（city 存成「国家|地区|城市」，同名城市不混）
--   device / lang
-- 来源类的三个只算进站浏览；其余的算全部浏览。
create table if not exists cms_stats_daily_dims (
  day date not null,
  locale text not null,
  dim text not null,
  value text not null,
  views integer not null default 0,
  visitors integer not null default 0,
  primary key (day, locale, dim, value)
);
create index if not exists idx_cms_stats_dims_lookup on cms_stats_daily_dims (locale, dim, day);

-- 单篇文章的来源类别和国家，供文章统计页用。
create table if not exists cms_stats_daily_article_dims (
  day date not null,
  locale text not null,
  article_id uuid not null,
  dim text not null,
  value text not null,
  views integer not null default 0,
  primary key (day, locale, article_id, dim, value)
);
create index if not exists idx_cms_stats_article_dims on cms_stats_daily_article_dims (locale, article_id, day);

do $$
declare tbl text;
begin
  foreach tbl in array array['cms_stats_daily', 'cms_stats_daily_pages', 'cms_stats_daily_dims', 'cms_stats_daily_article_dims'] loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists %I on %I', tbl || '_no_access', tbl);
    -- 只有 service_role：读者的地理分布不该用公开的 key 读得到。
    execute format('create policy %I on %I for all using (false) with check (false)', tbl || '_no_access', tbl);
  end loop;
end $$;

-- 区间汇总放在库里做：30 天的页面行可能有十几万，拉回应用里再加是浪费。

create or replace function cms_stats_top_articles(p_locale text, p_from date, p_to date, p_limit integer default 50)
returns table (article_id uuid, views bigint, visitors bigint)
language sql stable security definer set search_path = public as $$
  select article_id, sum(views)::bigint, sum(visitors)::bigint
  from cms_stats_daily_pages
  where locale = p_locale and day between p_from and p_to and article_id is not null
  group by article_id
  order by 2 desc
  limit p_limit
$$;

create or replace function cms_stats_top_pages(p_locale text, p_from date, p_to date, p_limit integer default 30)
returns table (path text, kind text, views bigint, visitors bigint)
language sql stable security definer set search_path = public as $$
  select path, min(kind), sum(views)::bigint, sum(visitors)::bigint
  from cms_stats_daily_pages
  where locale = p_locale and day between p_from and p_to
  group by path
  order by 3 desc
  limit p_limit
$$;

create or replace function cms_stats_dim(p_locale text, p_from date, p_to date, p_dim text, p_limit integer default 30)
returns table (value text, views bigint, visitors bigint)
language sql stable security definer set search_path = public as $$
  select value, sum(views)::bigint, sum(visitors)::bigint
  from cms_stats_daily_dims
  where locale = p_locale and day between p_from and p_to and dim = p_dim
  group by value
  order by 2 desc
  limit p_limit
$$;

-- 文章列表的「7 天阅读」列：一页文章的 id 一次查完。
create or replace function cms_stats_article_views(p_locale text, p_from date, p_to date, p_ids uuid[])
returns table (article_id uuid, views bigint)
language sql stable security definer set search_path = public as $$
  select article_id, sum(views)::bigint
  from cms_stats_daily_pages
  where locale = p_locale and day between p_from and p_to and article_id = any(p_ids)
  group by article_id
$$;

create or replace function cms_stats_article_dim(p_locale text, p_from date, p_to date, p_article uuid, p_dim text)
returns table (value text, views bigint)
language sql stable security definer set search_path = public as $$
  select value, sum(views)::bigint
  from cms_stats_daily_article_dims
  where locale = p_locale and day between p_from and p_to and article_id = p_article and dim = p_dim
  group by value
  order by 2 desc
$$;

revoke all on function cms_stats_top_articles(text, date, date, integer) from public, anon, authenticated;
revoke all on function cms_stats_top_pages(text, date, date, integer) from public, anon, authenticated;
revoke all on function cms_stats_dim(text, date, date, text, integer) from public, anon, authenticated;
revoke all on function cms_stats_article_views(text, date, date, uuid[]) from public, anon, authenticated;
revoke all on function cms_stats_article_dim(text, date, date, uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
