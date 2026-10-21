-- record_search_miss 加上 locale。
--
-- 037 给 cms_search_misses 加了 locale 列和 (query, locale) 唯一索引，但函数还在
-- 写 `on conflict (query)` —— 那条路现在仍然可用（旧主键还在），可是四个站的词会
-- 混在同一行上累加：德文读者搜了一个词没找到，中文站的「读者搜了却没找到」面板
-- 上就会多一条德文。
--
-- ## 为什么是 drop 再 create，而不是直接 create or replace
--
-- 加一个参数就是换签名，Postgres 把它当成另一个函数。两个版本并存时
-- `record_search_miss('x')` 这样的单参数调用会同时匹配旧的一参版和新的二参带默认
-- 值版，报「function is not unique」。所以必须先删旧的。
--
-- ## 为什么新参数有默认值
--
-- 迁移先落地、代码后部署，中间那段时间线上跑的还是只传 p_query 的旧代码。带默认
-- 值它就照常工作（算到 zh 名下，而那时确实只有中文站）。没有默认值的话，这段时间
-- 每一次「搜索无结果」都会在日志里报错。

drop function if exists record_search_miss(text);

create or replace function record_search_miss(p_query text, p_locale text default 'zh')
returns void
language sql
as $$
  insert into cms_search_misses (query, locale, hits, first_seen, last_seen)
  values (p_query, p_locale, 1, now(), now())
  on conflict (query, locale) do update
    set hits = cms_search_misses.hits + 1,
        last_seen = now();
$$;
