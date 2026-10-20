-- 删一篇内容之前，先问清楚「删掉会牵连什么」。
--
-- 2026-10-16 编辑把「铁证如山」32 集改成视频重新发布，然后删掉了重复的文章版。
-- 这个判断是对的 —— 内容确实搬到了视频区。但有 32 条旧 WP 链接指着那些文章，
-- 删完就全变成 308 跳 404，而后台从头到尾没有提过这件事：删除接口不碰重定向，
-- 编辑也无从知道有谁指着这一篇。断了四天，是顺着重定向表随机抽查才撞上的。
--
-- 所以这两个函数要回答的是对话框上该写什么：
--
--   redirects_to_paths    有多少条旧链接指着这一篇 —— 删掉之后它们会 404
--   content_inbound_links 站内还有哪些内容链接到这一篇 —— 删掉之后那里会出现死链
--
-- 为什么只报告、不自动改：链接指向一篇即将不存在的文章，没有哪个自动改法是对的。
-- 改成栏目首页是降级，直接删掉链接是丢信息，而「内容搬去了视频区第 26 集」这种
-- 对应关系只有人知道。所以把事实摆给做决定的人，让他决定。
--
-- 为什么做成数据库函数：要在四张表的正文里找字符串。放在应用里就得把一万六千
-- 篇正文拉出来，而这里一次查询 600 毫秒（在生产上量过）。

-- 指向这些地址的重定向。改名也要算进去：一篇文章可能既有人指着它的拼音地址，
-- 也有人指着它迁移前的中文地址。
create or replace function redirects_to_paths(p_paths text[])
returns table (legacy_url text, destination_url text)
language sql
stable
as $$
  select r.legacy_url, r.destination_url
  from cms_redirects r
  where r.destination_url = any(p_paths)
  order by r.legacy_url
$$;

-- 正文里出现过这些地址的内容。
--
-- p_needles 传多个写法，因为同一篇的链接在站内有好几种形态：当前拼音地址、
-- 迁移前的中文地址、短码地址 /a/xxx，以及带域名的绝对地址。少传一种，就会漏报
-- 一批死链，而漏报比多报危险 —— 多报只是让人多看一眼。
--
-- p_exclude_id 是这一篇自己：一篇文章在正文里引用自己的地址（比如「本文地址」）
-- 不算牵连，报出来只会让人疑惑。
create or replace function content_inbound_links(p_needles text[], p_exclude_id text default null)
returns table (kind text, id text, label text, slug text)
language sql
stable
as $$
  select 'article'::text, a.id::text, a.title, a.slug
  from cms_articles a
  where a.id::text is distinct from p_exclude_id
    and exists (select 1 from unnest(p_needles) n where position(n in coalesce(a.body_markdown, '')) > 0)
  union all
  select 'video'::text, v.id::text, v.title, v.slug
  from cms_videos v
  where v.id::text is distinct from p_exclude_id
    and exists (select 1 from unnest(p_needles) n where position(n in coalesce(v.body_markdown, '')) > 0)
  union all
  select 'faq'::text, f.id::text, f.question, f.slug
  from cms_faqs f
  where exists (select 1 from unnest(p_needles) n where position(n in coalesce(f.answer_markdown, '')) > 0)
  union all
  -- 页面内容没有标题，path 就是它的名字（例如 home、services/faq）。
  select 'page'::text, e.id::text, e.path, e.path
  from cms_content_entries e
  where exists (select 1 from unnest(p_needles) n where position(n in e.data::text) > 0)
$$;
