# 站点与文章访问统计（方案 C）

状态：2026-10-29 已定案，第 1–4 步已写完。Worker 已上线（stats.tdinfo.org），网站部分待推送。

## 要回答的问题

- 全站每天多少浏览、多少访客，趋势如何；中文站、英文站分开看。
- 每篇文章的阅读数，按日 / 周 / 月排行；后台文章列表里直接显示。
- 读者从哪里来：
  - 来源：搜索引擎、社交平台、其他网站、直接打开 / 消息应用、电子报。
  - 地区：国家，可选到城市。
  - 设备与浏览器语言。

## 两条硬约束

1. **不碰 Supabase 的请求路径。** 2026-10-13 那次是几亿次请求灌一篇文章，文章页才改成缓存。
   如果每次阅读都写一次数据库，等于给攻击者重新开一扇门。
   所以每次阅读只记到 Cloudflare，数据库每天只收一次汇总。
2. **读者隐私。** 不用 cookie，不存 IP，不存完整 UA，不接第三方统计。
   读者是看退党内容的人，统计数据本身就不能变成一份名单。

## 架构

```
浏览器（文章页 / 任意页）
  │  navigator.sendBeacon  —— 页面加载后发一次，约 200 字节
  ▼
Cloudflare Worker  quitccp-stats      （Workers Paid，已开通）
  │  · 丢掉机器人 UA、限流（同一来源每分钟上限）
  │  · 用 request.cf 取国家 / 城市 —— IP 只在内存里用，不落地
  │  · 写一条数据点
  ▼
Workers Analytics Engine  数据集 quitccp_hits   （保留 3 个月）
  │
  │  每天 UTC 01:00，Worker 定时任务按天汇总
  ▼
Supabase  analytics_daily_*  （永久保留，每天只写几千行）
  ▲
  │  后台读取：历史读 Supabase，「今天」实时查 Analytics Engine SQL API
/admin/stats  +  文章列表「阅读」列
```

为什么是 Analytics Engine，而不是 Worker 直接写 Supabase：

- 它就是为「每次请求记一笔」设计的，写入不会排队，被刷也只是多一些数据点。
- 刷量的成本由 Cloudflare 承担，Postgres 那边看不到任何压力。

## 每条记录的字段

| 字段 | 内容 | 说明 |
|---|---|---|
| index | `zh:/news/<slug>` | 站点 + 路径，用于按页面查询 |
| blob1 | 站点 `zh` / `en` | |
| blob2 | 页面类型 `article` / `listing` / `home` / `video` / `other` | |
| blob3 | 文章 slug | 只在文章页有值；短地址 /a/ 也换算成 slug |
| blob4 | 来源域名 | `document.referrer` 只取主机名，例如 `www.google.com` |
| blob5 | 来源类别 | 搜索 / 社交 / 外站 / 站内 / 直接 / 电子报 |
| blob6 | `utm_source` | 电子报、推送等自己发出的链接用 |
| blob7 | 国家 | `request.cf.country` |
| blob8 | 城市 | `request.cf.city`，待确认要不要（见下文「待决定」） |
| blob9 | 设备 | 手机 / 平板 / 电脑，由 UA 粗分，不存 UA 本身 |
| blob10 | 浏览器语言 | `navigator.language` 的前两段，例如 `zh-TW` |
| blob11 | 访客指纹 | 见下 |
| double1 | 1 | 计数 |

**访客数怎么算（不用 cookie）**：采用 Plausible 的做法。

- 计算 `hash(每日盐 + IP + UA + 站点)`，只保留前 16 位。
- 盐每天换一次，旧盐丢掉。
- 所以同一个人当天算一个访客，第二天就认不出来，也无法跨天追踪。
- 这个值只用来去重，任何地方都不显示。

**新访客 / 回访**（可选）：浏览器 localStorage 里记一个「来过」的标记，只发送「是 / 否」，不发送任何编号。

## 来源分类

`document.referrer` 的主机名按规则表归类，规则表放在后台可改（遵循「能在后台改的就别写死」）：

- **搜索**：google.\*、bing、duckduckgo、yahoo、yandex、naver、ecosia、brave 等。
- **社交**：facebook、x.com / t.co、youtube、instagram、reddit、telegram 网页版、ganjing 等。
- **站内**：tuidang.org 自身，以及中、英两站互相跳转。
- **外站**：上面都不是的其他网站，保留域名，可以看出哪些网站在链接我们。
- **直接**：没有 referrer。

需要提前说明的限制：**Signal、WhatsApp、Telegram 等 App 打开链接时通常不带 referrer**，所以这些都会算成「直接」。

如果想把消息应用单独统计出来，有两个办法：

- 站内的「分享」按钮生成链接时自动加 `?utm_source=signal` 之类的参数。
- 编辑自己往外发的链接（电子报、群发）也加 `utm_source`。

## 防刷与过滤

- **只算真正执行了 JS 的浏览器**：beacon 由页面脚本发出，大部分爬虫不会触发；Vercel 挑战页拦下的请求也不会触发。
- **Worker 内过滤**：丢掉 UA 含 bot / crawler / spider / preview 的请求，丢掉 Signal 等生成链接预览时的抓取。
- **限流**：用 Workers Rate Limiting 绑定，同一 IP + 路径每分钟只算前几次，超出直接回 204、不记录。所以刷量既刷不坏网站，也刷不歪排行。
- **Origin 校验**：只收来自 tuidang.org、quitccp-en.vercel.app（以后换成英文正式域名）的请求。

## 后台页面 `/admin/stats`

权限：沿用 permission-matrix，新增一项 `stats.view`。默认给管理员和主编，待确认。

- **总览**：今天 / 7 天 / 30 天的浏览量与访客数，30 天趋势图。
- **热门文章**：可切换今天 / 7 天 / 30 天 / 自选区间，点进去看单篇。
- **单篇文章**：每日阅读曲线、来源构成、地区构成。文章编辑页也放一个「阅读数据」入口。
- **来源**：类别占比 + 来源域名排行（例如 Google 多少、某个转载网站多少）。
- **地区**：国家排行（可选城市排行）。
- **设备与语言**：手机 / 电脑占比，简体 / 繁体 / 英文读者占比。
- 每个后台只看自己站点的数据，与现有的 locale 隔离一致。

文章列表（`ArticleTable`）加一列「7 天阅读」，可排序。

## Supabase 表

```sql
-- 每天每页一行
analytics_daily_pages (day date, locale text, path text, article_slug text,
                       views int, visitors int, primary key (day, locale, path))
-- 每天每个维度值一行：dim = source_type | source_host | country | city | device | lang | utm
analytics_daily_dims  (day date, locale text, dim text, value text,
                       views int, visitors int, primary key (day, locale, dim, value))
-- 文章 × 来源类别 × 国家，供单篇文章页使用；只保留有阅读的组合
analytics_daily_article_dims (day date, locale text, article_slug text, dim text, value text,
                              views int, primary key (day, locale, article_slug, dim, value))
```

只允许 service role 写入；后台通过服务端读取，不对 anon 开放。

## 费用估算

Workers Paid 每月已含：

- Worker 请求：1,000 万次。
- Analytics Engine：1,000 万个数据点写入、100 万次查询。超出部分每百万次写入 $0.25，每百万次查询 $1。
  Cloudflare 目前还没有开始对 Analytics Engine 收费。

一次浏览 = 1 次 Worker 请求 + 1 个数据点。
月浏览量在 1,000 万以内，基本不会多花钱；超过的话，每多 100 万次浏览大约多 $0.55。

## 分步上线

| 步 | 内容 | 预计 |
|---|---|---|
| 1 | Worker + 数据集 + beacon 组件，先只采集，不做后台 | 半天 |
| 2 | 每日汇总定时任务 + Supabase 三张表 + 迁移 | 半天 |
| 3 | `/admin/stats` 总览、热门文章、来源、地区 | 1 天 |
| 4 | 单篇文章页、文章列表「阅读」列、来源规则表后台可改 | 半天 |
| 5 | 分享按钮加 utm_source（可选） | 1–2 小时 |

第 1 步先上，让数据开始累积。数据保留 3 个月，所以后台晚几天做也不会丢数据。

## 已定（2026-10-29）

1. **记到城市。** 存成「国家|地区|城市」，只做汇总。
2. **统计域名用 `stats.tdinfo.org`。** tdinfo.org 和 Worker 在同一个 Cloudflare 账号，绑成 Worker 的 custom domain。
3. **所有编辑都能看。** 后台侧栏「访问统计」不设权限。
4. **中英文站分开统计，英文站暂不统计。** 由两处把关：
   - Worker 的 `SITES` 只认 tuidang.org 的 Origin。
   - `lib/site-stats.ts` 的 `STATS_LOCALES` 只有 `zh`。

## 实际落地

| 部分 | 位置 |
|---|---|
| Worker | `workers/quitccp-stats/`。KV 存每日盐，两个限流绑定 |
| beacon | `components/public/PageViewBeacon.tsx`，挂在根布局里 |
| 汇总 | `lib/admin/site-stats-rollup.ts`，`/api/cron/stats-rollup`，每天 01:25 UTC |
| 来源规则 | `lib/admin/stats-sources.ts`（先写在代码里，以后再挪到后台） |
| 表 | 迁移 045：`cms_stats_daily`、`_pages`、`_dims`、`_article_dims` |
| 后台 | `/admin/stats`、`/admin/stats/article/<id>`，以及文章列表的「7 天阅读」列 |

部署后还需要在 Vercel 中文站项目里配两个环境变量：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ANALYTICS_TOKEN`：只开 Account Analytics: Read 权限。

**补数据**：Analytics Engine 保留 3 个月，在这个期限内都可以重跑汇总：
- `/api/cron/stats-rollup?days=N`：补最近 N 天。
- `?today=1`：连今天一起汇总，用于手工检查整条链路。
