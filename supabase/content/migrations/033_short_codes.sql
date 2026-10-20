-- 每篇文章、每支视频一个短码，用来做可以分享的短地址。
--
-- 现在的公开地址是中文标题，编码之后是一堵 %E4%B8 —— 实测那支「三退洪聲 第
-- 65集」的视频地址 258 个字符，最长的一条 611 个。贴进微信、印到传单上、念给
-- 人听，都不成立。对这个站还有一层额外的代价：一个劝人退党的网站，分享出去的
-- 链接长成一串百分号，看起来像钓鱼链接 —— 这是信任问题，不是美观问题。
--
--   /news/8%E6%9C%88115%E4%B8%87%E4%BA%BA…   168 字符
--   /a/k3m9x2p                                34 字符
--
-- ## 为什么是随机码，不是自增数字
--
-- 自增 ID 等于把全站目录递给人：从 1 数到 16218 就能遍历所有内容。这个站
-- 2026-10-13 刚被 DDoS 打过，攻击瞄准的正是一个可枚举的 legacy URL，
-- lib/legacy-redirect-ids.ts 里那套「这个 id 可能存在吗」的预检就是为此加的。
-- 随机码没有这个问题，也不泄露「我们一共有多少内容」。
--
-- ## 为什么去掉易混字符
--
-- 字母表是 23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz —— 没有
-- 0/O/o、1/l/I。这些链接会被印在传单和展板上、被人用眼睛抄、被念出来。
-- 57 个字符取 7 位是 1.95 万亿种组合，对 16,218 条内容绰绰有余。
--
-- ## 为什么短码不跟着 slug 走
--
-- 它指向的是这一行数据，不是地址。所以将来把 16,218 条全部改成拼音地址时，
-- 已经分享出去的短链一条都不会断 —— 短码先铺开，等于给那次改名上了保险。
-- 正因如此，短码一旦发出去就不能再改，也不能回收重用。

alter table cms_articles add column if not exists short_code text;
alter table cms_videos   add column if not exists short_code text;

comment on column cms_articles.short_code is
  '可分享的短地址 /a/<code>。发出去之后不要改、不要回收重用 —— 外面可能已经有人在用它了。';
comment on column cms_videos.short_code is
  '可分享的短地址 /v/<code>。发出去之后不要改、不要回收重用 —— 外面可能已经有人在用它了。';

-- 唯一索引既保证不重复，也是查询路径：/a/<code> 每次访问都走它。
-- 部分索引（where not null）是因为回填之前这两列大部分是空的，而多个 null
-- 在唯一约束下本来就不冲突 —— 写明 where 只是让索引小一点、意图清楚一点。
create unique index if not exists cms_articles_short_code_key
  on cms_articles (short_code) where short_code is not null;
create unique index if not exists cms_videos_short_code_key
  on cms_videos (short_code) where short_code is not null;
