-- 多语言第三步：收缩。删掉只认 slug 的旧唯一约束。
--
-- ## 这是 037 说好的第三步，一直没做
--
-- 037 的头注写着三步：
--
--   037   扩张：加 locale 列，加 (slug, locale) 复合唯一索引。旧约束原样保留。
--   代码   切换：把 11 处 upsert 指向新的复合键。
--   038   收缩：删掉旧的单列唯一约束。
--
-- 前两步做完了 —— 代码里现在一处裸的 `onConflict: "slug"` 都没有。但 038 那个
-- 号被挪去修 cms_site_settings 了，收缩从此没人做。037 自己预言过后果：
--
--   「等第二种语言的数据进来，前者才会开始挡路
--     —— 所以 038 必须在英文站灌入内容之前跑完，这是硬顺序。」
--
-- 现在就是那个时候。实测（在事务里试插再回滚）：
--
--   英文站建一个 slug 叫 withdrawal-news 的分类  → 被 cms_article_categories_slug_key 拒
--   英文站建一条 slug 叫 letter-gongzhi 的资料    → 被 cms_materials_slug_key 拒
--   英文站存自己的 site.theme                     → 被 cms_site_settings_setting_key_key 拒
--
-- 最后那条最要紧：英文站连自己的主题和自检状态都写不进去，而这跟内容无关，
-- 是开站第一天就会撞上的。
--
-- ## 这份清单是查出来的，不是手写的
--
-- 判据：同一张表上既有唯一索引 (cols)、又有唯一索引 (cols + locale) —— 后者是
-- 037 加的，前者就是该删的那个。按这个判据查出 11 对，和 037 头注里说的「11 处
-- upsert」正好对上。手写清单在这个项目里已经漏过一次（locale:check 那回），
-- 所以这次让库自己说。
--
-- 另外两类单列唯一键**不在**清单里，因为它们没有按站的对应索引，本来就该是全局的：
--
--   cms_articles_short_code_key / cms_videos_short_code_key
--       短码是 /a/XXXX 这个地址空间，四个站共用一套，重了就会指错站。
--   cms_faqs_legacy_id_key / idx_cms_videos_legacy_id
--       来自同一个 WordPress，号本来就不重。
--
-- ## 跑这个之前确认过
--
--   - 代码里没有任何 `onConflict` 指着将被删掉的那些单列键（全部已是复合键）
--   - 这 11 个约束都没有被外键引用（有的话根本删不掉）
--   - 库里现在只有 zh 一种数据，所以删掉更严的那条，不会让任何现有数据变得不合法
--
-- ## 中文站会怎么样
--
-- 不怎么样。删掉的是「比现在生效的那条更严格」的约束：unique(slug) 满足则
-- unique(slug, locale) 必然满足，反过来不成立。只有当第二种语言的数据进来时，
-- 两者才会分道扬镳 —— 而那正是我们要的。

-- ---------------------------------------------------------------- 普通唯一约束

-- 分类与标签：各语言的编辑团队自己定栏目结构，
-- 英文站的 news 和中文站的 news 是两个不同的栏目。
alter table cms_article_categories  drop constraint if exists cms_article_categories_slug_key;
alter table cms_video_categories    drop constraint if exists cms_video_categories_slug_key;
alter table cms_material_categories drop constraint if exists cms_material_categories_slug_key;
alter table cms_faq_categories      drop constraint if exists cms_faq_categories_slug_key;
alter table cms_article_tags        drop constraint if exists cms_article_tags_slug_key;

-- 内容：英文站的 letter-autumn 和中文站的 letter-autumn 是同一份材料的两个语言版本，
-- 不是冲突。
alter table cms_videos    drop constraint if exists cms_videos_slug_key;
alter table cms_materials drop constraint if exists cms_materials_slug_key;

-- 重定向：037 已经说过 —— 英文站和德文站都会有 /news/about-us，
-- legacy_url 不带语言就会互相覆盖。
alter table cms_redirects drop constraint if exists cms_redirects_legacy_url_key;

-- 站点设置：038 建了 (setting_key, locale)，但没删这条。于是每个 setting_key
-- 全库只能有一行 —— 英文站存不了自己的 site.theme，也存不了自己的自检状态。
alter table cms_site_settings drop constraint if exists cms_site_settings_setting_key_key;

-- ---------------------------------------------------------------- 主键

-- 这两张表的主键建在业务列上（hour / query），不是 id。所以不能只删不补：
-- 删完表就没主键了。把 037 建的那个复合唯一索引直接提升成主键 ——
-- USING INDEX 会复用现有索引（不重建、不重排），并把它改名成约束名。
--
-- 两张都是运维表（日志按小时汇总、搜不到结果的词），不被任何外键引用。

alter table cms_log_hourly drop constraint if exists cms_log_hourly_pkey;
alter table cms_log_hourly
  add constraint cms_log_hourly_pkey primary key using index cms_log_hourly_hour_locale_key;

alter table cms_search_misses drop constraint if exists cms_search_misses_pkey;
alter table cms_search_misses
  add constraint cms_search_misses_pkey primary key using index cms_search_misses_query_locale_key;
