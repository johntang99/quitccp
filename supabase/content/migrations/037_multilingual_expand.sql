-- 多语言第一步：扩张。只加东西，不动任何现有约束。
--
-- ## 为什么分三步
--
-- 把 unique(slug) 换成 unique(slug, locale) 会让代码里的 `on conflict (slug)`
-- 立刻失效 —— PostgREST 要求 onConflict 指定的列上有一个匹配的唯一索引，旧的
-- 一没了，upsert 当场报错。全站有 11 处这样的 upsert：文章标签、文章分类、视频
-- 的 slug，重定向的 legacy_url，自检状态的 setting_key，日志汇总的 hour。
--
-- 迁移和代码同时上线能解决，但那中间一定有一个窗口 —— 新表结构已经生效而旧代码
-- 还在跑，或者反过来。所以改成三步，每一步单独都是安全的：
--
--   037（这个）  扩张：加 locale 列，加新的复合唯一索引。**旧约束原样保留。**
--                两套索引并存，旧的 `on conflict (slug)` 继续工作。
--   代码          切换：把 11 处 upsert 指向新的复合键。此时新索引已经在了。
--   038           收缩：删掉旧的单列唯一约束。
--
-- 为什么两套能并存：现在库里只有 zh 一种数据，unique(slug) 比 unique(slug, locale)
-- 更严格，前者满足则后者必然满足。等第二种语言的数据进来，前者才会开始挡路 ——
-- **所以 038 必须在英文站灌入内容之前跑完**，这是硬顺序。
--
-- ## 这一步之后，中文站的行为不变
--
-- 新加的列全部有默认值 'zh'，现有的行自动归位；新加的索引比现有约束宽松，
-- 不会拒绝任何现在能写进去的数据。

-- ---------------------------------------------------------------- 内容表

-- cms_videos 是唯一一张完全没有 locale 的内容表。
-- 其余（articles / faqs / pages / materials / content_entries）当初就有。
alter table cms_videos add column if not exists locale text not null default 'zh';
create unique index if not exists cms_videos_slug_locale_key on cms_videos (slug, locale);

-- cms_materials 有 locale，但唯一键只认 slug。
create unique index if not exists cms_materials_slug_locale_key on cms_materials (slug, locale);

-- ---------------------------------------------------------------- 分类与标签

-- 德文站的「新闻」和中文站的「新闻」是两个不同的栏目，不是同一个的两种叫法。
-- 各语言的编辑团队要能自己定栏目结构，所以分类按语言分开。
alter table cms_article_categories  add column if not exists locale text not null default 'zh';
alter table cms_video_categories    add column if not exists locale text not null default 'zh';
alter table cms_material_categories add column if not exists locale text not null default 'zh';
alter table cms_faq_categories      add column if not exists locale text not null default 'zh';
alter table cms_article_tags        add column if not exists locale text not null default 'zh';

create unique index if not exists cms_article_categories_slug_locale_key  on cms_article_categories (slug, locale);
create unique index if not exists cms_video_categories_slug_locale_key    on cms_video_categories (slug, locale);
create unique index if not exists cms_material_categories_slug_locale_key on cms_material_categories (slug, locale);
create unique index if not exists cms_faq_categories_slug_locale_key      on cms_faq_categories (slug, locale);
create unique index if not exists cms_article_tags_slug_locale_key        on cms_article_tags (slug, locale);

-- ---------------------------------------------------------------- 重定向

-- 英文站和德文站都会有 /news/about-us，legacy_url 不带语言就会互相覆盖。
alter table cms_redirects add column if not exists locale text not null default 'zh';
create unique index if not exists cms_redirects_legacy_url_locale_key on cms_redirects (legacy_url, locale);

-- ---------------------------------------------------------------- 运维表
--
-- 这三张最容易被漏掉，而且漏掉不会报错，只会让几个站互相覆盖对方的数据。

-- 自检每小时把结果写进 setting_key = 'ops.selfcheck.report'。四个站各跑各的 cron，
-- 写的是同一行 —— 面板上看到的永远是最后跑完那个站的结果，而且看不出来。
--
-- locale 可空：null 表示这条设置全站共享（比如站点开关），非空表示属于某个站。
-- 唯一索引里用 coalesce 兜底，否则 null 在唯一索引里互不相等，共享设置会出现多行。
alter table cms_site_settings add column if not exists locale text;
create unique index if not exists cms_site_settings_key_locale_key
  on cms_site_settings (setting_key, coalesce(locale, '*'));

-- 日志汇总的主键是 hour，四个站的汇总会互相覆盖。
alter table cms_log_hourly add column if not exists locale text not null default 'zh';
create unique index if not exists cms_log_hourly_hour_locale_key on cms_log_hourly (hour, locale);

-- 「读者搜了却没找到的词」各站各算，否则德文的词会混进中文站的面板。
alter table cms_search_misses add column if not exists locale text not null default 'zh';
create unique index if not exists cms_search_misses_query_locale_key on cms_search_misses (query, locale);

-- 审计记录要能按站筛。可空，因为有些操作（比如改全局设置）不属于任何单一语言。
alter table cms_audit_logs add column if not exists locale text;
create index if not exists idx_cms_audit_logs_locale on cms_audit_logs (locale, created_at desc);

-- ---------------------------------------------------------------- 权限

-- 这个人能管哪些语言。空数组 = 不限（超级管理员）。
--
-- 它是权限的第三重，不是唯一一重：写操作要同时满足「角色有这个能力」「目标内容的
-- locale 在这个数组里」「等于当前站的 SITE_LOCALE」。三重都查，因为每一重都可能
-- 被单独绕过 —— 比如有人直接调 API 而不经过某个站的域名。
alter table cms_admin_users add column if not exists locales text[] not null default '{}';

-- ---------------------------------------------------------------- 媒体

-- 媒体库**不按语言隔离**：logo、通用真相资料、活动照片，德文站该能直接用中文站
-- 传的那张，重新上传一遍是浪费。这一列只用于媒体库界面的筛选，不参与权限判断。
alter table cms_media_assets add column if not exists uploaded_locale text;

-- ---------------------------------------------------------------- 一致性检查
--
-- 关联表（article_category_map 等）不带 locale，靠两端的行继承。它们因此可能被写成
-- 跨语言的错误关联 —— 把中文文章挂到德文分类上。收口层会在写入时校验，但代码层的
-- 校验挡不住已经写进去的脏数据，所以这里提供一个对账函数给每小时自检用。
create or replace function count_cross_locale_links()
returns integer
language sql
stable
as $$
  select (
    (select count(*) from cms_article_category_map m
      join cms_articles a on a.id = m.article_id
      join cms_article_categories c on c.id = m.category_id
     where a.locale is distinct from c.locale)
  + (select count(*) from cms_video_category_map m
      join cms_videos v on v.id = m.video_id
      join cms_video_categories c on c.id = m.category_id
     where v.locale is distinct from c.locale)
  + (select count(*) from cms_material_category_map m
      join cms_materials mt on mt.id = m.material_id
      join cms_material_categories c on c.id = m.category_id
     where mt.locale is distinct from c.locale)
  + (select count(*) from cms_article_tag_map m
      join cms_articles a on a.id = m.article_id
      join cms_article_tags t on t.id = m.tag_id
     where a.locale is distinct from t.locale)
  )::integer;
$$;
