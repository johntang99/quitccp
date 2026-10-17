-- 哪些文章分类有公开列表页，从代码搬到数据库。
--
-- 之前这件事写死在 lib/public-content.ts 的 NEWS_CATEGORIES 里：十八个分类中
-- 只有八个在那张表里，于是 /news/culture-music 这类地址一律 404，而要让一个
-- 分类对外可见就得改代码再部署一次。2026-10-17 定下的规矩是「能在后台改的
-- 就别写死在代码里」—— 这一列让编辑自己决定某个栏目要不要对外。
--
-- 常量没有删：数据库读不到时它仍是兜底（八个 tab 的名字），而且英文眉题
-- （WITHDRAWAL NEWS 之类）后台没有对应字段，仍然从那里取。
--
-- 同时按反馈把 红色渗透 和 围堵中共 开出来，排在原来那八个之后。

alter table cms_article_categories
  add column if not exists is_news_listing boolean not null default false;

comment on column cms_article_categories.is_news_listing is
  '勾上才有公开的 /news/<slug> 列表页，并出现在新闻页顶部的分类 tab 里。';

update cms_article_categories set is_news_listing = true
  where slug in (
    'announcement-claims', 'red-regime-collapse', 'withdrawal-news',
    'worldwide-supports', 'worldwide-investigation', 'topics-commentary',
    'withdrawal-stories', 'famous-quitccp',
    -- 本次新开的两个
    'ccp-influence', 'countering-ccp'
  );

-- 新开的两个要进 1..10 这一段，否则它们带着导入时留下的 108/102 排到最后。
update cms_article_categories set sort_order = 9  where slug = 'ccp-influence';
update cms_article_categories set sort_order = 10 where slug = 'countering-ccp';

notify pgrst, 'reload schema';
