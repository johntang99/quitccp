-- 审计日志补上 locale。
--
-- 037 给 cms_audit_logs 加了 locale 列，但没有任何代码写它 —— 一万多行全是
-- null，计划里「后台审计页按站筛选」那条因此从来没能实现，而且谁也没发现：
-- 一列没人写也没人读的数据，不会报错。
--
-- 为什么回填成 zh：这些记录是中文站产生的，那时候只有一个站。
--
-- 顺序要紧。这是一次「加宽」的改动（把 null 填上），所以**先跑 SQL 再部署
-- 代码**：代码里 listAudits 加了 .eq("locale", SITE_LOCALE)，在回填之前部署
-- 会让审计页一行都显示不出来 —— 不报错，只是空的，而空的审计页看起来像
-- 「这个站没人操作过」，不像「查询条件不对」。

update cms_audit_logs
   set locale = 'zh'
 where locale is null;

-- 以后新写的行由代码带上 locale（见 lib/admin/repository.ts 等四处 insert）。
-- 不设列默认值：默认值会让「忘了写」这件事继续看不出来，而四个站共用一张表时，
-- 默认成 zh 等于把德文站的操作记成中文站的。宁可留 null 让对账查出来。
--
-- 对账：这一列不该再出现 null。
--   select count(*) from cms_audit_logs where locale is null;
