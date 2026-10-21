# 多语言实施方案

把现在的中文站扩成中文、英文、德文、日文四个站。

写给执行这件事的工程师，以及需要排期和拍板的人。每一节都写明**改什么、为什么、怎么验证、出问题怎么退**。

最后更新：2026-10-21

---

## 零、结论与三条原则

**一套代码，一个数据库，N 个 Vercel 项目，N 个域名。**

```
GitHub: johntang99/quitccp        一个仓库，一个 main，一份代码
            │
    ┌───────┼───────┬───────┐
  Vercel  Vercel  Vercel  Vercel     同一份代码构建四次
   (zh)    (en)    (de)    (ja)      各自的 SITE_LOCALE、域名、环境变量
    └───────┴───┬───┴───────┘
                │
         一个 Supabase 项目            表结构只有一份，不可能漂移
         locale 列区分内容
```

### 原则一：代码不分叉

改一个功能，改一次，四个站下次部署全都有。任何"这个站特殊处理一下"的冲动，都要先问能不能变成一条数据或一个环境变量。

### 原则二：locale 决定「行为」和「归属」，不决定「代码路径」

同一段代码在不同站上做不同的事，差异来自注入的 locale，而不是 `if (locale === 'zh')` 散落各处。拼音、繁简、字体、日期格式都走**策略表**，加一门语言是加一行配置。

### 原则三：靠机器，不靠纪律

这个方案唯一的真风险是"某处查询忘了按 locale 过滤"。对策不是提醒自己记得，是**收口到一个地方 + 自动检查绕过行为**。

> 为什么不是四个独立数据库：讨论过并否决了。独立库省掉了 locale 过滤的工作，但带来「漏跑迁移」——一个**几乎必然发生、沉默、几周后才暴露**的失败。而漏写 locale 过滤是**可以在一个收口层拦住、并且能自动查出来**的失败。用沉默必然换吵闹可拦，不划算。

---

## 一、现状盘点（实测，非估计）

### 已经就绪

| 项 | 实测结果 |
|---|---|
| Schema 本来就按多语言设计 | `cms_articles` 唯一索引 **`(slug, locale)`**；`cms_content_entries` **`(locale, path)`**；`cms_faqs` **`(slug, locale)`**；`cms_pages` **`(section, slug, locale)`**。默认值都是 `'zh'` |
| 页面内容全是数据 | `cms_content_entries` 64 条 / 153 KB，含首页、导航、页脚、关于、参与、法律页、各栏目落地页 |
| 搜索本来就接受 locale | `searchWithMeilisearch(query, locale, …)`，过滤条件里已有 `locale = "…"` |
| 后台界面零直连数据库 | `app/admin/**` 143 个文件，**直接访问数据库的是 0 个**，全部走 `lib/admin` |
| 查询高度集中 | 全站查 `cms_*` 共 230 处 / 32 个文件，**71% 在 5 个文件里** |
| 站点身份已走环境变量 | 11 个文件读 `NEXT_PUBLIC_SITE_URL` |
| 角色模型已有 | `super_admin` / `content_admin` / `editor`（`lib/admin/permissions.ts`） |
| 公开站写死的中文很少 | **3,268 字**（约三四百条文案） |

### 缺口

| 项 | 实测结果 | 严重度 |
|---|---|---|
| `cms_videos` | **没有 locale 列**，唯一索引只认 `slug` | 高 |
| `cms_materials` | 有 locale，唯一索引只认 `slug` | 高 |
| `cms_redirects` | 没有 locale，唯一索引只认 `legacy_url` | 高 |
| 分类表 ×4、标签表 | 没有 locale，唯一索引只认 `slug` | 高 |
| **`cms_site_settings`** | 唯一索引 `setting_key`。**四个站的自检状态会互相覆盖** | **高，且静默** |
| **`cms_log_hourly`** | 主键是 `hour`。**四个站的日志会互相覆盖** | **高，且静默** |
| `cms_search_misses` | 主键是 `query`，四个站的搜索失败词会混在一起 | 中 |
| `cms_admin_users` | 没有"这个人能管哪些语言" | 高 |
| `cms_audit_logs` | 没有 locale，审计记录无法按站筛 | 中 |
| `public-content.ts` | 10 处写死 `"zh"` | 高 |
| 网址生成 | `pinyin-pro` 写死，中文专属 | 高 |
| 搜索 | 繁简变体表（`zh-variants.ts`）中文专属 | 中 |
| 后台界面中文 | **26,679 字**（公开站的 8 倍） | 高，见第五章 |
| 字体 | `fonts.ts` 只加载 Noto Serif SC | 中 |
| 迁移执行器 | **不存在**。36 个 SQL 文件靠手工跑，**没有任何表记录跑到哪一号** | 高 |

> `cms_site_settings` 和 `cms_log_hourly` 这两条要特别注意：它们不会报错，只会让四个站互相覆盖对方的数据，而症状是"自检面板的数字忽大忽小"这种没人会立刻联想到多语言的现象。

---

## 一·五、这不是从零开始：已有的语言站

`lib/site-languages.ts` 里记着首页语言下拉的真实去向，**组织已经有这些站**，各自跑在 WordPress 上：

| 语言 | 域名 | 状态（2026-10-21 实测） |
|---|---|---|
| 中文 | `www.tuidang.org` | ✅ 已是新平台 |
| English | `global.tuidang.org` | WordPress，403 挡 curl |
| 한국어 | `kr.tuidang.org` | WordPress，403 挡 curl |
| 日本語 | `www.quitccp.jp` | WordPress，200 |
| Română | `ro.tuidang.org` | WordPress，403 挡 curl |
| Deutsch | `de.tuidang.org` | **不解析**，下拉里已移除 |

两件事因此要改变认知：

**一、语言不止四种。** 除了中英德日，还有**韩文和罗马尼亚文**两个在运行的站。方案必须按"N 种语言"设计，不能按"四种"写死。

**二、每开一个站不是建新站，是替换一个 WordPress 站。** 和中文站当初一样，要带上：

- 存量内容迁移（中文站当初是 15,372 篇）
- 旧网址重定向（中文站现在 31,632 条）
- 媒体文件搬运
- 现有编辑团队的账号

德文是唯一真正从零开始的——`de.tuidang.org` 没有站。

> **日文站的网址问题和中文站当初一模一样。** 实测首页 116 条站内链接，**59 条网址里带日文**，形如
> `/2021/02/14/感染後に味覚・嗅覚障害となった元武漢市民が語/` —— 同样是 WordPress 的日期型固定链接，
> 同样从标题中间截断，粘出去同样是一串百分号。

---

## 二、数据库（Supabase）

### 2.1 一个 Supabase 项目，两套迁移

现状：`supabase/content/migrations/`（36 个）和 `supabase/service/migrations/`（5 个）在同一个 Supabase 项目里。

- **content**：文章、视频、资料、问答、页面、媒体、后台用户 → **要加 locale**
- **service**：三退声明、退党证书、`service_users` → **不加 locale，见 2.5**

### 2.2 补齐表结构（迁移 `037_multilingual.sql`）

分三组。每一组都可单独回退。

**第一组：内容表加 locale**

```sql
-- cms_videos 完全没有 locale。默认 'zh' 让现有 846 条自动归位。
alter table cms_videos add column if not exists locale text not null default 'zh';
drop index if exists cms_videos_slug_key;
create unique index cms_videos_slug_locale_key on cms_videos (slug, locale);

-- cms_materials 有 locale，但唯一索引只认 slug。
drop index if exists cms_materials_slug_key;
create unique index cms_materials_slug_locale_key on cms_materials (slug, locale);
```

**第二组：分类、标签、重定向**

```sql
-- 四张分类表和标签表。德文站的「新闻」和中文站的「新闻」是两个不同的东西。
alter table cms_article_categories  add column if not exists locale text not null default 'zh';
alter table cms_video_categories    add column if not exists locale text not null default 'zh';
alter table cms_material_categories add column if not exists locale text not null default 'zh';
alter table cms_faq_categories      add column if not exists locale text not null default 'zh';
alter table cms_article_tags        add column if not exists locale text not null default 'zh';
-- 对应地把 unique(slug) 换成 unique(slug, locale)，五张表同样处理。

-- 重定向：德文站和英文站都会有 /news/about-us。
alter table cms_redirects add column if not exists locale text not null default 'zh';
drop index if exists cms_redirects_legacy_url_key;
create unique index cms_redirects_legacy_url_locale_key on cms_redirects (legacy_url, locale);
```

**第三组：运维表（这组最容易被漏掉）**

```sql
-- 自检状态和报告。不加这个，四个站的 cron 会互相覆盖同一个 key，
-- 面板上看到的是最后一个跑完的站的结果，而且看不出来。
alter table cms_site_settings add column if not exists locale text;  -- null = 全站共享
drop index if exists cms_site_settings_setting_key_key;
create unique index cms_site_settings_key_locale_key
  on cms_site_settings (setting_key, coalesce(locale, '*'));

-- 日志汇总。主键是 hour，四个站会互相覆盖。
alter table cms_log_hourly add column if not exists locale text not null default 'zh';
alter table cms_log_hourly drop constraint cms_log_hourly_pkey;
alter table cms_log_hourly add primary key (hour, locale);

-- 搜索失败词：各站各算，否则德文的词会污染中文的「读者搜了没找到」面板。
alter table cms_search_misses add column if not exists locale text not null default 'zh';
alter table cms_search_misses drop constraint cms_search_misses_pkey;
alter table cms_search_misses add primary key (query, locale);
-- record_search_miss() 要跟着改签名。

-- 审计日志：按站筛选用。
alter table cms_audit_logs add column if not exists locale text;
create index if not exists idx_cms_audit_logs_locale on cms_audit_logs (locale, created_at desc);
```

**第四组：后台用户能管哪些语言**

```sql
-- 空数组 = 不限（超管）。['zh'] = 只能管中文站。
alter table cms_admin_users add column if not exists locales text[] not null default '{}';
```

**关联表的一致性**

`cms_article_category_map` 等三张关联表不加 locale，但要防止"把中文文章挂到德文分类上"。两个办法：

- 轻：收口层在写入时校验两边 locale 一致
- 重：复合外键（需要给 `(id, locale)` 建唯一索引）

**建议先用轻的**，并在自检里加一条对账查询，报出跨语言的错误关联数。

### 2.3 不加 locale 的表，和理由

| 表 | 为什么保持全局 |
|---|---|
| `cms_media_assets` | **图片资源跨语言共享是好事**。logo、通用真相资料、活动照片，德文站该能直接用中文站上传的那张。媒体库界面给个语言筛选即可 |
| `short_code`（文章/视频列） | 全局唯一正是我们要的。短码绑在行上，跨站也不会撞 |
| `cms_revisions` | 靠 `entity_type` + `entity_id` 继承 |
| `declarations` / `certificates` | 见 2.5 |

### 2.4 迁移执行器（**必须先做**）

现状：没有执行器，也没有任何表记录跑过哪些迁移。034、035、036 都是临时写脚本手工执行的。

单库让"漂移"不再是问题，但"**这个库到底跑到第几号**"今天仍然答不出来，只能翻聊天记录。要做的：

- `schema_migrations` 表：文件名、校验和、执行时间、执行人
- `npm run migrate`：比对文件夹和表，只跑差集，**默认预演**，`--apply` 才执行
- 校验和不匹配时**拒绝执行并报警**——有人改了已经跑过的迁移文件，这是最危险的一种情况
- 跑完打印状态

> 这件事对现在的单站也有价值，和多语言无关。建议作为**第 0 步**。

### 2.5 三退声明和证书：不分语言

`declarations`、`certificates`、`service_users` 保持全局，不加 locale。

**理由：三退是一个全球性的行为，不是某个语言站的内容。** 一个人用德文界面提交的声明，和用中文界面提交的，进的是同一本登记册，计入同一个总数（首页那个 4.67 亿）。按语言分开登记会让总数失去意义。

需要做的只有一件：声明表单记录**提交来源的站点**（`source_locale`），供统计用，不影响归属。

---

## 三、代码

### 3.1 locale 收口层（这一章是整个方案的核心）

**不要在 230 个调用点上各加一句 `.eq("locale", …)`。** 那正是会被忘记的写法。

做一个 `lib/supabase/locale-scoped.ts`：

```ts
// 对带 locale 的表自动加过滤；不带 locale 的表原样放行。
// 表名清单写死在这里，加表时必须在这里登记 —— 这是有意的摩擦。
const LOCALE_TABLES = new Set([
  "cms_articles", "cms_videos", "cms_materials", "cms_faqs",
  "cms_pages", "cms_content_entries", "cms_redirects",
  "cms_article_categories", "cms_video_categories",
  "cms_material_categories", "cms_faq_categories", "cms_article_tags"
]);

export function localeScoped(locale: string) { /* 包装 .from() */ }
```

然后 5 个文件各改一行 import：

| 文件 | 调用点 |
|---|---|
| `lib/admin/repository.ts` | 58 |
| `lib/public-content.ts` | 51 |
| `lib/admin/video-repository.ts` | 27 |
| `lib/admin/material-repository.ts` | 16 |
| `lib/admin/content-repository.ts` | 12 |

剩下的 27 个文件逐个过一遍，大多是按 `id` 查（id 全局唯一，不需要过滤）或运维表。

**写入路径同样要收口**：插入时自动补 `locale`，而不是指望每个 `insert` 都带上。

### 3.2 防绕过检查（和收口层同等重要）

收口层的漏洞是：有人直接 `import { createSupabaseAdminClient }` 绕过去。对策：

1. **一条脚本** `npm run locale:check`：扫描 `lib/admin/**` 和 `app/api/admin/**`，报出在收口层之外直接建客户端、且查了带 locale 的表的地方
2. **进 CI**：GitHub Actions 已有 `lint`/`typecheck`/`test`，加这一条
3. **进每小时自检**：加一条数据对账 —— 有没有 locale 为空、或跨语言错误关联的行

> 第 3 条是关键。前两条防的是新代码，第 3 条防的是**已经写进数据库的错误**。今天那条「旧链接去向」就是这个模式，它值得复制。

### 3.3 站点配置：`SITE_LOCALE` 与策略表

```ts
// lib/site-config.ts
export const SITE = {
  locale: process.env.SITE_LOCALE ?? "zh",   // zh | en | de | ja
  // 以下全部由 locale 查表得到，不写 if-else
} as const;
```

一张策略表决定每种语言的行为：

| 维度 | zh | en | de | ja |
|---|---|---|---|---|
| 网址转写 | 拼音（`pinyin-pro`） | 直接 slugify | slugify + 变音转写 | 罗马字（**见 3.4**） |
| 搜索变体 | 繁简互通 | 无 | ä/ö/ü/ß 折叠 | 假名归一化 |
| 排序 | `zh-Hans-CN` | `en` | `de` | `ja` |
| 日期格式 | 2026年10月20日 | Oct 20, 2026 | 20.10.2026 | 2026年10月20日 |
| 标题字体 | Noto Serif SC | 拉丁衬线 | 拉丁衬线 | Noto Serif JP |
| 正文字体 | 系统 CJK | 可用网络字体 | 可用网络字体 | 系统 CJK |

### 3.4 网址策略：三层框架（对以后再加语言同样成立）

四种语言统一保持 **`YYYY-MM-DD-<转写>`**，80 字上限，撞名加 `-2`，日期取这一篇自己的发布时间。
变的只是「转写」那一段怎么来。

不要为每种语言单独想办法 —— 那样每加一门语言就要重新研究一次。按**书写系统**分三层：

| 层 | 适用 | 办法 | 要不要词典 |
|---|---|---|---|
| **一、拉丁字母** | en de ro fr es it… | 折叠变音符 + slugify | 否 |
| **二、表音的非拉丁字母** | ko ru el th… | 算法式转写 | 否 |
| **三、需要词典或词法分析** | zh ja | 有转写器就用，**没有就退到日期 + 短码** | 是 |

**第一层**：`ä→ae ö→oe ü→ue ß→ss`（德文）、`ă→a ș→s ț→t`（罗马尼亚文）。
直接剥离变音符会得到错误的词 —— `Grüße` 应是 `gruesse`，不是 `gruse`。每种语言一张折叠表，十几行。

**第二层**：韩文谚文是字母，有官方的罗马字转写规则（Revised Romanization），纯算法、无词典。
俄文、希腊文、泰文同理。**加一门这类语言 = 加一张转写表，不加依赖。**

**第三层**：中文已经有 `pinyin-pro`（含词组词典，重庆→chong-qing、银行→yin-hang），保留。
日文的汉字转罗马字需要词法分析（kuromoji 一类，约 15 MB 词典）—— 但**不需要做**，理由在下面。

#### 日文（以及所有第三层无转写器的语言）：日期 + 短码

**`/news/2026-10-21-k3Xm9Qp`**

这不是退而求其次，这正是日本和韩国媒体自己的做法。2026-10-21 实测：

| 媒体 | 网址形态 |
|---|---|
| 産経新聞 | `/article/20261021-KKC2HMBAUVBITHUBNMJX6EXY6U/` |
| 読売新聞 | `/election/20261021-GYT1T00169/` |
| NHK | `/newsweb/pl/news-nwa-topic-nationwide-E0000000168` |
| 朝日新聞 | `/shimen/20261021/index_tokyo_list.html` |
| **大紀元日本** | `/2026/10/391425.html` |
| 聯合ニュース（韓） | `/view/AKR20261021065900001` |
| **大紀元韓国** | `/2026/10/771583.html` |

**没有一家把标题转成罗马字。** 全部是日期 + 不透明 ID。两家姐妹媒体（大纪元日文版、韩文版）
用的还是同一个形态 `/YYYY/MM/<数字>.html`。

也就是说：日文读者**本来就不指望网址可读**。给他们一串罗马字，既不符合当地习惯，
又要背一个 15 MB 的词典和一套分词的错误率。

**而且短码我们已经有了。** `short_code` 是 7 位、从 57 个字符的表里取，每条内容入库即发，
全局唯一，并且**绑在行上不绑地址**。拿它当网址主体，零新增依赖、零新增词典、零失败模式。

#### 这个框架怎么对付「以后还会加语言」

加一门新语言时只问一句：**它属于哪一层？**

- 拉丁字母 → 写一张十几行的折叠表，半小时
- 表音字母 → 写一张转写表，一两小时
- 需要词典 → **直接用日期 + 短码**，零工作量；哪天觉得值得，再补转写器，
  老地址靠 `cms_redirects` 继续有效

**没有一门语言会卡住上线。** 这是这个框架最重要的性质。

#### 实现

```ts
// lib/slug/transliterate.ts
type Transliterator = (title: string) => string;

const BY_LOCALE: Record<string, Transliterator> = {
  zh: pinyinTransliterate,      // 现有
  en: latinSlugify,
  de: (t) => latinSlugify(foldGerman(t)),
  ro: (t) => latinSlugify(foldRomanian(t)),
  ko: hangulRomanize,           // 第二层，排到韩文站时写
  // ja 不登记 —— 走兜底
};

export function slugBody(title: string, locale: string, shortCode: string): string {
  const f = BY_LOCALE[locale];
  const out = f?.(title) ?? "";
  /* 转写器产出为空也走兜底：中文标题全是生僻字、德文标题只有标点，
     都会落到这里。网址宁可不可读，也不能没有。 */
  return out || shortCode;
}
```

**没登记 = 自动走日期 + 短码。** 加语言不改这段代码。

### 3.5 搜索

现状：Meilisearch + 数据库直查兜底，索引名来自 `MEILI_INDEX_ARTICLES` 环境变量。

**建议：一个 locale 一个索引**（`articles_zh`、`articles_en`…）。

理由：Meilisearch 的分词器是按索引配置的，中文分词和德文分词要求不同。而且**索引名已经是环境变量**——这意味着零代码改动，每站配一个值即可。

繁简变体表（`zh-variants.ts`）只在 `locale === 'zh'` 时参与，由策略表控制。

### 3.6 语言包

| 范围 | 中文字数 | 说明 |
|---|---|---|
| 公开站界面 | **3,268** | 约三四百条，一两天 |
| 后台界面 | **26,679** | 见第五章的决策 |

技术选型：项目目前**没有装任何 i18n 库**。建议用 `next-intl`（和 App Router 配合好），或者更轻的方案——因为路由不需要语言前缀（域名已经区分），实际只需要"一个 locale → 一张文案表"的查表，自己写一个 50 行的也够。

**建议自己写**，理由是依赖越少越好，而这里用不到 i18n 库的大部分能力（路由、复数、时区协商）。

### 3.7 字体

现状（`app/fonts.ts`）：只加载 Noto Serif SC 的 700 字重给标题，正文用系统 CJK 字体，并且特意 `preload: false`——因为 CJK 字体是约 100 个 unicode-range 分片，长文会拉爆流量。

四语言的处理：

- **zh**：不变
- **ja**：换 Noto Serif JP，正文同样用系统字体（Hiragino Mincho / Yu Gothic）
- **en / de**：**纯拉丁，是净收益**。可以正经加载一套拉丁衬线 + 无衬线，总量几十 KB，没有 CJK 分片问题

`fonts.ts` 改成按 `SITE_LOCALE` 导出不同组合。

### 3.8 其他语言相关细节

- `localeCompare(a, b, "zh-Hans-CN")` 在 `public-content.ts:1427`，要改成按 locale
- 日期格式化：现在散落在组件里，收口到一个 `formatDate(date, locale)`
- 数字：德文用 `.` 作千分位（`467.645.280`），中文用 `4.67 亿`。首页那个计数器需要按语言换展示方式

---

## 四、前台

### 4.1 路由不加语言前缀

**不做 `/en/news/...`，做 `en.example.org/news/...`。**

理由：

- 你的需求是**不同域名**，域名本身已经区分了语言
- 不加前缀意味着**路由代码一个字都不用改**
- 对 SEO 更好：每个语言是独立站点，独立权重
- 短链 `/a/<code>`、`/v/<code>` 保持原样

### 4.2 SEO

- `sitemap.ts`：按 `SITE_LOCALE` 只列本站内容（现在是全量，要加过滤）
- `robots.ts`：各站各自
- `canonical`：指向本站域名
- **`hreflang`：先不做**。四个站是独立采编、不是互译，没有对应关系可声明。将来若有同一篇的多语版本，再加 `alternate`

### 4.3 分享块与打印

- 短链、二维码：逻辑不变，域名换成本站
- 分享目标：X、Facebook、Telegram、WhatsApp、邮件 —— **要按语言调整**。德日读者的常用渠道不同（日本：LINE、X；德国：WhatsApp、Telegram）。建议做成策略表的一项
- 转载条款（打印版里那段）：各语言各写一份，进 `cms_content_entries`
- 微信二维码对中文站是刚需，对德文站意义不大 —— 但保留无害，不做特判

---

## 五、后台

### 5.1 后台界面用什么语言（**最大的一笔账，需要拍板**）

后台界面文字 26,679 个汉字，是公开站的 8 倍。

**建议：后台只出中文和英文两版。德文、日文团队用英文后台。**

- 内容语言 ≠ 工具语言，这是业界常规（WordPress、Strapi 的多数团队都用英文后台）
- 把后台翻成每一种编辑语言是无底洞，而且每加一个功能就要再翻一遍
- **这一条决定了将来每加一个语言站的成本**：有它，加站只是填内容；没有它，每加一站多两万字翻译

### 5.2 一个后台入口还是四个

**四个，各站用各站的域名访问自己的后台。**

同一套后台软件，但德文编辑登 `de.example.org/admin`，中文编辑登 `www.tuidang.org/admin`。

好处是：权限的第一道防线是"你登的是哪个站"，而不只是数据库里的一个字段。

### 5.3 权限：角色 × 语言

现有三级角色不变，加一个维度：

| | 能管的语言 | 说明 |
|---|---|---|
| `super_admin` | 全部 | `locales = '{}'` 表示不限 |
| `content_admin` | 指定 | 通常是本站所属语言 |
| `editor` | 指定 | 只能是本站所属语言 |

**关键规则：任何写操作都要同时满足 (a) 角色有该能力 (b) 目标内容的 locale 在此人的 `locales` 里 (c) 等于当前站的 `SITE_LOCALE`。** 三重，因为每一重都可能被绕过。

### 5.4 跨语言可见（你提的第 3 条需求）

单库的最大红利在这里。可以做：

- **只读的跨语言浏览**：德文编辑能看中文站发了什么，用来选题
- **内容关联**：标记"这篇是中文站某篇的德文版"，前台可显示"另有中文版"
- **统一的媒体库**：共享图片资源

**但要明确：可见 ≠ 可改。** 跨语言一律只读，写操作严格限本语言。

### 5.5 审计日志

加 locale，并在后台审计页按站筛选。跨语言的误操作要能一眼看出来。

---

## 六、Vercel

### 6.1 N 个项目，同一个仓库

四个 Vercel 项目都指向 `johntang99/quitccp` 的 `main`。一次 `git push`，四个项目各自收到 webhook、用各自的环境变量构建。

**不需要推四次。**

### 6.2 环境变量：哪些共用、哪些每站不同

| 变量 | 每站不同 | 说明 |
|---|---|---|
| `SITE_LOCALE` | ✅ | 新增，驱动一切语言相关行为 |
| `NEXT_PUBLIC_SITE_URL` | ✅ | 各自域名 |
| `MEILI_INDEX_ARTICLES` | ✅ | `articles_zh` / `articles_en` / … |
| `ADMIN_OWNER_EMAIL` | ✅ | 各站的所有者 |
| `ALERT_EMAIL_TO` | ✅ | 各团队收各自的报警 |
| `CRON_SECRET` | ✅ | 各站一个，泄露不互相牵连 |
| `JWT_SECRET` | ✅ | **必须不同**，否则一个站的会话能登另一个站 |
| `PROBE_BYPASS_SECRET` | ✅ | 对应各自的防火墙规则 |
| `DATABASE_URL` / `SUPABASE_*` | ❌ 共用 | 同一个库 |
| `R2_*` | ❌ 共用 | 同一个桶，见第八章 |
| `NEXT_PUBLIC_MEDIA_MIRROR_HOST` | ❌ 共用 | 同一个镜像 |
| `OPENAI_API_KEY` / `RESEND_API_KEY` | ❌ 共用 | 同一个账号 |

> `JWT_SECRET` 必须每站不同这一条容易漏。共用的话，德文站签发的会话 cookie 能直接通过中文站的验证。

### 6.3 Cron：**必须按站控制**（容易出事的一点）

Cron 定义在 `apps/web/vercel.json` 里，**而这个文件在仓库里，四个项目都会读到它**。也就是说四个站都会跑全部七个定时任务。

逐个过一遍：

| Cron | 该在哪些站跑 | 处理 |
|---|---|---|
| `/api/cron/santui` | **只中文站** | 抓 santui.tuidang.org 的登记册数字。路由里判断 `SITE_LOCALE !== 'zh'` 就直接返回 |
| `/api/cron/endccp` | **只中文站** | 抓 `endccp.com/zh-hans/` |
| `/api/cron/zhuichaguoji` | **只中文站** | 抓追查国际的中文 RSS |
| `/api/cron/search` | 每站都跑 | 同步各自的 Meilisearch 索引 |
| `/api/cron/selfcheck` | 每站都跑 | **前提是 2.2 第三组的 `cms_site_settings` 改造已完成**，否则互相覆盖 |
| `/api/cron/log-rollup` | 每站都跑 | 同上，依赖 `cms_log_hourly` 改造 |

**做法**：在路由开头加一个统一的 `onlyForLocales(['zh'])` 守卫，不跑就返回 `{ skipped: true, locale }`——返回 200 而不是报错，否则 Vercel 的 cron 面板会一直红着。

> 登记册数字（4.67 亿）是全球总数，四个站都要显示，但**只需要一个站去抓**，其他站从数据库读。

### 6.4 防火墙

每个 Vercel 项目的防火墙规则是独立的，要各配一份：

- 托管的 Bot Protection（Challenge）
- 每 IP 限速
- 自检探针放行（`x-quitccp-probe`）

**已知问题要一并修正**：中文站现在 `Bypass for selfcheck probe` 是第 15 条，而 `Rate limit per IP` 是第 8 条，规则自上而下匹配，放行规则轮不到执行。**新站配置时放行规则必须排在限速和挑战之上。**

### 6.5 域名

每个项目绑各自的域名。域名还没定，需要先确定（这会影响邮件模板、分享文案、法律页里的主体名称）。

---

## 七、GitHub

- **一个仓库，一个 `main`**。分仓库是最糟的选项，那才叫真的"四套系统"
- CI（`.github/workflows/ci.yml`）现有 `lint` / `typecheck` / `test` / `test:studio`，**要加**：
  - `npm run locale:check`（3.2 的绕过检查）
  - `npm run redirects:check`（已有，但 CI 没有数据库凭据，需要加 secret 或移到自检）
- **暂不做**分支分站。全部跟 `main`。将来若需要灰度，给日文站（流量最小）单开一个 `canary` 分支先验

---

## 八、Cloudflare R2 与媒体

### 8.1 一个桶，不按语言分

现状：媒体在 Supabase Storage（`media` 桶），路径形如 `media/home/<时间戳>-<文件名>`，共 8,072 个资源；R2 镜像由 `NEXT_PUBLIC_MEDIA_MIRROR_HOST` 控制开关。

**建议四个站共用一个桶、一个镜像主机。**

理由：

- `cms_media_assets` 保持全局（见 2.3），图片跨语言共享是**好事**——logo、通用真相资料、活动照片
- 按语言分前缀会让"德文站想用中文站那张照片"变成一次重新上传
- 省一套 R2 配置和一个镜像域名

代价：德文编辑能在媒体库里看到中文站上传的图片。**这不是问题，是功能。**

### 8.2 要做的

- 媒体库界面加一个「上传站点」筛选（`cms_media_assets` 加一个 `uploaded_locale` 列，仅用于筛选，不用于权限）
- 文件名现在带时间戳，天然不撞，不用改
- R2 的日志桶（`R2_LOG_BUCKET`）保持共用，日志里按 host 已能区分

### 8.3 待办（与多语言无关，但一并记下）

- Cloudflare token 待轮换
- Supabase 存储桶待改为私有
- `SUPABASE_STORAGE_BUCKET=media` 未进 GitHub secrets

---

## 九、外部依赖清单

| 依赖 | 影响 | 处理 |
|---|---|---|
| Meilisearch | 索引按 locale 分 | 新建三个索引，配各站环境变量 |
| Resend（邮件） | 报警邮件、密码重置 | 模板按语言出四份；发件人地址可共用 |
| OpenAI（AI 摘要） | 摘要要用对应语言生成 | 提示词里带上目标语言 |
| Browserless | 只中文站的 santui 抓取用 | 不变 |
| santui.tuidang.org | 中文站专属数据源 | 不变，数字全站共享 |
| endccp.com | 中文站专属 | 其他语言站若有对应源，另议 |
| 追查国际 RSS | 中文站专属 | 同上 |

---

## 十、分阶段执行

每个阶段都**独立可交付、可验证、可回退**，并且前三个阶段**对现有中文站只有好处，没有风险**。

### 第 0 阶段：迁移执行器（1–2 天）

与多语言无关，但后面每一步都依赖它。

- `schema_migrations` 表 + `npm run migrate`
- 把已有的 36 个迁移补登记进去
- **验收**：`npm run migrate` 能正确报出"已是最新"

### 第 1 阶段：补齐表结构（1–2 天）

- `037_multilingual.sql`，四组改动
- 现在库里只有中文数据，默认值 `'zh'` 让所有现存行自动归位
- **验收**：中文站全部功能不变；自检八项全绿；`npm run redirects:check` 通过
- **回退**：每组独立，`drop column` 即可（唯一索引要还原）

### 第 2 阶段：locale 收口层 + 防绕过检查（3–5 天）

- `localeScoped()` + 5 个 repository 接上 + 27 个零散点清理
- `npm run locale:check` 进 CI
- 自检加一条数据对账
- **此时仍然只有中文**，`SITE_LOCALE=zh`，行为完全不变
- **验收**：中文站功能不变；故意写一处绕过，检查能报出来

### 第 3 阶段：语言策略化（5–8 天）

- `SITE_LOCALE` + 策略表
- slug 转写按语言（**日文方案需先拍板**）
- 搜索变体按语言
- 字体按语言
- 日期、数字、排序
- **验收**：`SITE_LOCALE=zh` 时与改造前逐页对比无差异

### 第 4 阶段：语言包（公开站 2 天 / 后台 按 5.1 的决策）

- 公开站 3,268 字抽出
- 后台按决策，中英两版
- **验收**：切换 `SITE_LOCALE` 能看到英文界面

### 第 5 阶段：开第一个站（英文，3–5 天）

选英文先行，因为拉丁转写最简单，能把流程跑通而不被日文罗马字卡住。

- 新 Vercel 项目 + 域名 + 环境变量 + 防火墙
- Meilisearch 新索引
- 播种一套英文页面骨架（`packages/content-schema` 要支持按 locale 播种）
- 建第一个英文管理员
- **验收**：英文站能发一篇文章、能搜到、短链和二维码正确、自检全绿、中文站不受影响

### 第 6 阶段：德文、日文（各 2–3 天）

到这一步应该只剩：开项目、配变量、播种、建账号、填内容。

- 德文：变音转写要专门验
- 日文：罗马字方案按第 3 阶段的决策落地

### 第 7 阶段：跨语言功能（按需）

- 跨语言只读浏览
- 内容关联（"另有中文版"）

---

## 十一、风险与回退

| 风险 | 概率 | 后果 | 对策 |
|---|---|---|---|
| 某处查询漏加 locale，德文编辑改到中文内容 | 中 | 严重 | 收口层 + CI 检查 + 自检对账，三道 |
| `cms_site_settings` / `cms_log_hourly` 没改就上线第二个站 | **高** | 自检和日志静默错乱 | 列为第 1 阶段必做，上线前跑一次对账 |
| 四个站同时部署，一个 bug 波及全部 | 中 | 中 | 先在英文站（流量最小）验证；必要时给一个站开 `canary` 分支 |
| `JWT_SECRET` 共用 | 低 | 严重 | 写进开站清单并在自检中校验各站不同 |
| Cron 四个站都跑抓取任务 | **高** | 对外部源的请求量 ×4，可能被封 | `onlyForLocales(['zh'])` 守卫，第 3 阶段完成 |
| 日文罗马字方案拖期 | 中 | 日文站延后 | 允许过渡期手填网址 |

**整体回退**：第 0–4 阶段任何一步出问题，都可以单独回退而不影响中文站，因为那时还只有 `SITE_LOCALE=zh` 一个站在跑。真正的不可逆点是**第 5 阶段开出第二个站之后**——从那以后表结构的改动要考虑两个站的数据。

---

## 十二、开新站清单

目标：让第四个站和第二个站一样省事。

```
1. 定域名
2. Supabase：不用动（同一个库）
3. Meilisearch：新建索引 articles_<locale>
4. Vercel：
   - 新建项目，指向 johntang99/quitccp 的 main
   - 环境变量（照第 6.2 的表，注意 JWT_SECRET 和 CRON_SECRET 必须新生成）
   - **`NEXT_PUBLIC_SITE_URL` 必须设成本站域名。** 不设的话 sitemap 和短链里
     写的是中文站的地址 —— 不报错，但提交给搜索引擎的是别人的链接
   - 绑域名
   - 防火墙三条规则，放行规则排在限速之上
5. 播种：npm run seed:site -- --locale=<locale>
   （页面骨架、导航、页脚、法律页、默认分类）
6. 建第一个管理员：npm run admin:create -- --locale=<locale> --email=...
7. 验收：
   - 发一篇测试文章 → 网址是本语言的转写规则
   - 搜得到
   - 短链和二维码指向本站域名
   - 自检八项全绿
   - 中文站自检不受影响
   - **sitemap 只含本站内容**：`curl <域名>/sitemap.xml | grep -c '<loc>'`，
     刚播种完应该是十几条，不是一万多条（见下面「按站取数据」那一节）
   - **搜索结果里没有别的语言的内容**
   - 删掉测试文章，确认删除对话框的牵连提示正常
```

---

## 按站取数据：2026-10-21 查出并修掉的六处泄漏

翻译后台总览页时，发现英文站后台显示的是中文站的内容量（15,372 篇文章）。
顺着查出一串，而当时 `locale:check` 报的是「所有查询都已按站限定」。

| 哪里 | 后果 | 状态 |
|---|---|---|
| 站点地图六张表无限定 | 英文站的 sitemap 列出一万五千篇中文文章并提交给搜索引擎 | 已修 |
| 搜索索引全量同步的清理条件无语言限定 | **英文站跑一次每周全量，删光中文站索引里的一万六千条** | 已修 |
| 视频在搜索索引 / 搜索后端 / 后台计数三处未按语言分 | 两站来回覆盖同一批视频文档；读者搜到别的语言的影片；搜索状态长期亮黄灯 | 已修 |
| 后台六个统计数字无限定 | 英文站显示中文站的内容量 | 已修 |
| 常见问答整个仓库层无 locale | 列表、分类、排序、新建全部跨站 | 已修 |
| 审计日志的 locale 列没有任何代码写 | 037 加的列，四处 insert 都没带，一万多行全 null；「审计页按站筛选」从未实现 | 已修（043 回填） |

### 检查器为什么没拦住

这是比那六处泄漏更要紧的部分。`locale:check` 当时在报「全绿」，而它根本没看那些代码：

1. **表名不是字面量就看不见**，23 处调用从未进入视野（`.from(source.table)`、`.from(TABLE)`）。
   现已解析同文件的字面量常量；真正动态的单列一栏说明「看不见，请人工过」。
2. **表清单手写，必然落后于 schema。** 原注释写着「这道摩擦是有意的」，而它没拦住任何事。
   现已改为问 `information_schema`，代码里那份只作兜底，**对不上就报**。
3. Buffer.from 被当成查询（封闭黑名单解决）。

> 教训和 569 条断链那次是同一个：**检查的是形状，不是事实。**
> 一个说「全绿」却没看见那行代码的检查器，比没有检查器更坏 —— 它让人不再去看。

### 遗留

- 审计页需要一个「看全部语言」的开关。现在按站过滤（和后台其他列表一致），
  但计划第 2.2 节原话是「跨语言的误操作要能一眼看出来」，按站过滤做不到这件事。
- Meilisearch 索引名仍来自 `MEILI_INDEX_ARTICLES`，默认 `articles`，四个站
  共用。清理条件已经按语言限定，所以不再会互删；但开新站时按清单第 3 条给
  各自建 `articles_<locale>` 更干净。

---

## 已定的决策（2026-10-21）

| # | 决策 | 结果 |
|---|---|---|
| 1 | 后台界面出几种语言 | **中、英两版。** 德、日、韩、罗团队用英文后台 |
| 2 | 日文网址怎么转写 | **不转写。日期 + 短码**，和日韩媒体自己的做法一致。见 3.4 的三层框架 |
| 3 | 域名 | 沿用现有：`global.tuidang.org`(en)、`www.quitccp.jp`(ja)、`kr.tuidang.org`(ko)、`ro.tuidang.org`(ro)。德文**暂定 `quitccp.de`**（DENIC 状态 `free`，待编辑团队确认后注册；.de 要求德国境内管理联系人）。方案里不依赖具体域名，改一个环境变量即可换 |
| 4 | 先开哪个 | **英文**，然后德文，日文later |

### 第 2 条的理由（摘要）

不是技术上做不到，是**日文读者本来就不指望网址可读**。2026-10-21 实测六家日本媒体、
两家韩国媒体，**没有一家把标题转成罗马字**，全部是日期 + 不透明 ID；两家姐妹媒体
（大纪元日文版、韩文版）用的是 `/2026/10/391425.html`。

而短码（`short_code`，7 位、全局唯一、入库即发）我们**已经有了**。用它做网址主体：
零新增依赖、零词典、零失败模式，而且对以后任何一门"难转写"的语言都适用。

---

## 还需要确认的

1. ~~德文站的域名~~ → 定为 `quitccp.de`，待注册
2. **韩文、罗马尼亚文的排期** —— 暂不排期，但框架按 N 种语言设计，到时只是填内容
3. **各语言站的存量内容量** —— 三个站 403 挡 curl，要用代理或从对方拿导出才能估迁移工作量

---

## 每改一次都要验一次中文站

中文站是唯一一个有真实读者、正在被攻击、承载 15,372 篇内容的站。多语言改造会
一路动到数据库和公共代码路径，所以**每一次改动之后都要跑**：

    npm run verify              # 生产
    npm run verify -- --local   # 本地 dev

一条命令查 29 项：12 个页面、4 条走不同代码路径的旧地址跳转、6 张表的行数下限、
迁移登记数、断链与跨语言对账、自检全部项目。只读，不写任何东西。

行数用的是**下限**不是精确值 —— 编辑每天在发内容，写死精确值的话这个脚本过几天
就要改一次，改着改着就没人信它了。低于下限才是真出事。

### 迁移的顺序纪律

2026-10-21 踩过一次：042 删掉旧函数签名的时间**早于**用新签名的代码部署，
中间那段时间生产自检的「旧链接去向」是「测不到」。不是用户可见的故障，但同一个
错误换一张表就是了。

所以凡是「删除或改窄」的迁移：**先部署不再用它的代码，再跑迁移。**
「新增或放宽」的迁移反过来，先跑迁移再部署代码。

---

## 执行进度

- [x] **第 0 阶段：迁移执行器 —— 已完成 2026-10-21**
  - `scripts/migrate.ts` + `npm run migrate`，默认预演
  - `schema_migrations` 表：(suite, filename) 主键、sha256 校验和、执行时间与执行人
  - 生产库已 baseline：content 36 个 + service 5 个，共 41 个登记为「已跑」，未执行任何 SQL
  - 三条拒绝路径实测通过：库里缺对象时拒绝 baseline、已跑过的文件被改过时整体拒绝、
    即使同时有新文件待跑也不放行
- [x] **第 1 阶段：补齐表结构 —— 扩张那一步已完成 2026-10-21**
  - `037_multilingual_expand.sql` 已上生产
  - **改成了扩张／切换／收缩三步**，原方案里「换掉唯一键」会打断 11 处 `on conflict`
  - 037 只加列和加新索引，**旧约束原样保留**，所以现有代码一行不用改
  - 实测：17 张表数据全部归位 zh；新旧唯一键并存；旧的 `on conflict (legacy_url)`
    和 `on conflict (setting_key)` 真跑一次仍然可用（已回滚）
  - 自检加了第 9 项「跨语言错误关联」，阈值 0
  - ⚠️ **038（收缩）必须在英文站灌入内容之前跑完** —— 旧的单列唯一键会挡住第二种语言的数据
- [ ] 第 2 阶段：locale 收口层
- [~] **第 3 阶段：语言策略化 —— 网址转写已完成 2026-10-21**
  - `lib/slug/transliterate.ts`：三层框架落地，9 项单元测试
  - **中文行为零变化**：拿全站 16,233 条真实标题新旧两版对跑，16,232 条一字不差；
    唯一一条不同的是泰文标题 —— 旧版返回空串（于是编辑手敲出了一个泰文地址），
    新版返回日期 + 短记号
  - `scripts/check-slug-regression.ts`：以后每次动转写层都跑，防止地址悄悄漂移
  - 前端离线兜底不再产生中文地址（以前接口一挂就会）
  - 待办：搜索变体按语言、字体按语言、日期与数字格式
- [~] 第 3 阶段剩余
  - [x] **搜索按语言 2026-10-21**：繁简变体表只给中文；全站写死的 `"zh"` 从 26 处清到 0
        （只剩中文专属 cron 守卫里的那几个，那是它们该有的样子）
  - [x] **新建时地址日期跟随发布时间**：`retargetSlugDate`，只换日期段
  - [x] **日期与数字格式 2026-10-21**：`lib/format.ts` 收口，HTML lang 属性、
        千分位、日期时间、排序全部按站。公开站和后台共 20 余处写死的 `"zh-CN"` 清掉
  - [x] **字体按语言 2026-10-21**：中文仍是 Noto Serif SC，英德罗走 Noto Serif
        （纯拉丁，没有 CJK 的上百个分片，可以放心 preload）。日韩等有站了再加 ——
        现在加既验证不了，又让每次构建多拉两套 CJK 字体
- [x] **第 3 阶段完成 2026-10-21**
- [ ] 第 4 阶段：语言包
- [ ] 第 5 阶段：英文站
