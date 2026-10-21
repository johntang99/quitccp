-- 把现有的站点设置归到中文站名下。
--
-- 038 定下 locale='*' 表示四个站共享。但现在库里那四行其实都**不该**共享：
--
--   ops.selfcheck.state    每个站自己的自检状态（上一轮哪些项是坏的）
--   ops.selfcheck.report   每个站自己的最近一次自检结果
--   ops.selfcheck.history  每个站自己的故障时间线
--   site.theme             站点主题。德文管理员改配色不该把中文站一起改了
--
-- 所以归到 'zh'。'*' 这个值留着，给将来真正全站共享的设置用 —— 目前一条都没有。
--
-- 顺序上这一步必须在代码改动**之前**：现在的代码只按 setting_key 查，不带 locale，
-- 无论这几行的 locale 是 '*' 还是 'zh' 都照样读得到。等代码改成带 locale 查，
-- 它要的就是 'zh' 这几行。反过来先改代码，中文站会有一小段时间读不到自己的主题。
update cms_site_settings
   set locale = 'zh'
 where locale = '*'
   and setting_key in ('ops.selfcheck.state', 'ops.selfcheck.report', 'ops.selfcheck.history', 'site.theme');
