-- 数一数有多少条重定向跳到了不存在的地址。
--
-- 为什么要有这么一个函数：这件事 2026-10-20 咬过一次，而且咬了两回。
--
--   * 「铁证如山」32 集 10-12 改成视频重发、10-16 删掉文章版，指向那些文章的
--     旧 WP 地址就开始 308 跳 404。内容明明还在站上，只是换了形态。
--   * 拼音迁移把文章的 slug 全改了，而旧站「中华传统文化」「资料下载」两栏
--     那 379 篇的重定向目标写的是 /resources/<中文 slug>，段前缀对不上，迁移
--     脚本没认出它们，于是整批从 10-19 起断掉。
--
-- 两回都不是当天发现的，是四天后顺着重定向表随机抽查才撞上的。站内爬虫撞不到
-- 它们 —— 没有任何页面链接到这些地址，sitemap 里也没有。唯一的入口是读者点
-- 来的旧链接，而读者不会报告 404。
--
-- 原来的 validate-redirects.ts 只验形状：legacy_url 不重复、以 / 开头、301、
-- 目标前缀在白名单里。/resources/乐曲-听儿说 每一项都合格。它从来没被问过
-- 「这个地址存在吗」。这个函数就是来问这一句的。
--
-- 为什么做成数据库函数而不在应用里算：要跨 cms_redirects 和三张内容表做
-- not exists，三万多行配一万六千行。放进每小时的自检里，只能是一次 count。
--
-- 带子目录的目标（/resources/downloads/<类>/<slug>）不算：那是资料详情页的
-- 正常地址，按 slug 配资料表配不上，但它本来就是通的。
create or replace function count_dead_redirects()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from cms_redirects r
  where r.destination_url ~ '^/[a-z]+/[^/]+$'
    and not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug)
    and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug)
    and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug);
$$;

-- 自检只拿到一个数字还不够 —— 看到「3 条」之后第一个问题一定是「哪三条」。
create or replace function list_dead_redirects(p_limit integer default 20)
returns table (legacy_url text, destination_url text)
language sql
stable
as $$
  select r.legacy_url, r.destination_url
  from cms_redirects r
  where r.destination_url ~ '^/[a-z]+/[^/]+$'
    and not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug)
    and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug)
    and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug)
  order by r.destination_url
  limit p_limit;
$$;
