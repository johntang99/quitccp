-- 修正 037 里 cms_site_settings 的做法。
--
-- 037 把 locale 设成可空，用 `unique (setting_key, coalesce(locale, '*'))` 兜底
-- null 在唯一索引里互不相等的问题。索引本身是对的，但**写不进去**：
--
--   PostgREST 的 onConflict 只接受列名，Postgres 的 ON CONFLICT 也要求推断出的
--   索引和写出来的列完全对应。`on conflict (setting_key, locale)` 匹配不上一个
--   建在 `coalesce(locale,'*')` 上的索引，于是四处 upsert 全部报
--   「there is no unique or exclusion constraint matching the ON CONFLICT
--   specification」。
--
-- 改成不可空 + 哨兵值 '*'：
--
--   locale = '*'    这条设置四个站共享（站点开关一类）
--   locale = 'zh'   这条设置属于中文站（自检状态和报告就是这种）
--
-- 哨兵值不如 null 优雅，但它能被 onConflict 直接写出来，而优雅的那个不能。
--
-- 037 已经登记并带了校验和，所以不回头改它 —— 改一个跑过的迁移会让库里的实际
-- 结构和文件内容对不上，执行器下次会整体拒绝。要修正就新写一个，这正是那条规矩
-- 想要的效果。

-- 037 之后这一列全是 null（四行都是原有的共享设置）。
update cms_site_settings set locale = '*' where locale is null;

alter table cms_site_settings alter column locale set default '*';
alter table cms_site_settings alter column locale set not null;

drop index if exists cms_site_settings_key_locale_key;
create unique index if not exists cms_site_settings_key_locale_key
  on cms_site_settings (setting_key, locale);
