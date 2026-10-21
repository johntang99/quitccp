-- 断链统计分语言。
--
-- 035 建这两个函数时只有中文站，所以它们数的是整张表。四个站之后这会变成一个
-- 刺眼的问题：每个站各跑各的自检，而「旧链接去向」这一项读的是全表 —— 中文站
-- 有一条断链，德文站的面板也会跟着变红，德文团队查不出原因，因为那条断链不在
-- 他们的站上。一个总是为别人的问题报警的检查，很快就没人看了。
--
-- p_locale 为 null 时仍然数全表 —— 给跨站盘点和脚本用。自检传 SITE_LOCALE。

create or replace function count_dead_redirects(p_locale text default null)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from cms_redirects r
  where r.destination_url ~ '^/[a-z]+/[^/]+$'
    and (p_locale is null or r.locale = p_locale)
    and not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug and a.locale = r.locale)
    and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug and v.locale = r.locale)
    and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug and m.locale = r.locale);
$$;

create or replace function list_dead_redirects(p_limit integer default 20, p_locale text default null)
returns table (legacy_url text, destination_url text, locale text)
language sql
stable
as $$
  select r.legacy_url, r.destination_url, r.locale
  from cms_redirects r
  where r.destination_url ~ '^/[a-z]+/[^/]+$'
    and (p_locale is null or r.locale = p_locale)
    and not exists (select 1 from cms_articles  a where r.destination_url = '/news/'      || a.slug and a.locale = r.locale)
    and not exists (select 1 from cms_videos    v where r.destination_url = '/videos/'    || v.slug and v.locale = r.locale)
    and not exists (select 1 from cms_materials m where r.destination_url = '/resources/' || m.slug and m.locale = r.locale)
  order by r.locale, r.destination_url
  limit p_limit;
$$;

-- 注意上面每个 not exists 里都多了一句 `and x.locale = r.locale`：
-- 一条中文重定向指向 /news/foo，而 /news/foo 只存在于英文站 —— 那对中文读者来说
-- 依然是断的。不比对 locale 的话，这种跨语言的「看起来有、其实点不到」会被漏掉。
