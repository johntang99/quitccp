# 媒体迁移到 R2：完整实施方案

把站点的图片、音频、视频从 Supabase Storage 搬到 Cloudflare R2，分三步走完。

写给执行这件事的工程师。每一步都写明了**改什么、为什么、怎么验证、出问题怎么退**。

最后更新：2026-10-14

---

## 为什么要做

三个理由，按重要性排序。

**一、Supabase Storage 不在任何防火墙后面。**

站上每一张图片的地址里都写着 `sukwifqplsyhbwmlfuti.supabase.co`。那台机器不是我们的域名，**放不进 Cloudflare，也没有可配置的 WAF 或限速规则**。有人猛打它，Vercel 那 8 条规则一条都用不上。

而 2026-10-13 那次，**Storage 和 Postgres 是一起返回 544 的**——它们在同一个项目下共用配额和基础设施。打爆 Storage，有可能把数据库一起拖下水，而那正是这几天所有加固工作要避免的事。

**二、静态化保住了页面，没保住页面里的媒体。**

缓存页由 Vercel 发出，但里面每张图仍要浏览器回 Supabase 取。10-13 那天，拿到完好缓存页的读者看到的仍是满页裂图——页面活下来了，内容没有。

**三、媒体只存在一个地方。**

8,507 个对象、6.0 GB、被 6,364 行内容引用，全部只在那一个出过事的项目里。

## 最终状态：三步走完之后，每天是怎么跑的

先把终点画出来，再看怎么走过去。

### 一次上传

```
编辑点「上传」
  ① 浏览器向后台要一张签名票据          ← Supabase 签发，私有桶照常工作（3.3 实测）
  ② 浏览器把字节直传到 Supabase 私有桶   ← 不经过我们的服务器，大文件也传得动
  ③ 后台注册接口：
       a. 把这个对象复制到 R2
       b. 把 ★R2 地址★ 写进 cms_media_assets
  ④ 编辑在图片库看到的、插进文章的、读者看到的 —— 全是 R2 地址
```

**Supabase 的公开地址从此不出现在任何地方**：不在数据库里、不在后台界面上、不在
页面 HTML 里。它失效了也无所谓，因为没有任何东西依赖它。

### 谁用哪个地址

| 谁要看这个文件 | 用什么地址 |
| --- | --- |
| 读者 | `media.tuidang.org/...`（R2，Cloudflare 保护） |
| 后台图片库、选图弹窗、文章预览 | 同上——R2 是公开的，预览直接能用 |
| 万一要取 Supabase 那一份 | `createSignedUrl` 发一个有时效的签名地址（3.3 实测 200） |

### 为什么还往 Supabase 传？直接传 R2 不是更干净？

看起来更干净，但**不该那样做**，理由正是这件事最初的出发点——中心当初说的是：
「不要把媒体全押在同一个 Supabase 项目上，至少要备份。」

如果改成「只传 R2、Supabase 退场」，就又回到**一个篮子**里了，只是换了个防护更好
的篮子。R2 删错一个前缀、令牌被误用、Cloudflare 出事，东西就没了。

所以最终状态是**两份都留，各司其职**：

| | 角色 |
| --- | --- |
| **Supabase（私有）** | 归档副本。只进不出，外界读不到，但东西在 |
| **R2（公开，Cloudflare 后面）** | 对外发布的那一份，读者只访问它 |

一边丢了另一边补得回来。这正是做镜像的全部意义——**只是主备角色和今天反过来了**：

```
今天      Supabase 对外发布   ←→   R2 是备份
做完之后   R2 对外发布        ←→   Supabase 是归档
```

那个「服务器复制到 R2」的步骤因此不是多余的中转，而是**刻意的冗余**。

## 现状清点（2026-10-13 实测）

| | |
| --- | --- |
| 对象数 | 8,507 |
| 总大小 | 6,039.5 MB |
| 图片（jpg/png/jpeg/gif/webp） | 8,156 个，占 **96%**，2.3 GB，**平均 0.29 MB** |
| 音频 mp3 | 285 个，2.7 GB |
| pdf / mp4 / zip | 64 个，1.0 GB |
| 最大单个文件 | 53.2 MB |

数据库里引用它的地方：

| 表 | 行数 | 含媒体地址的行 |
| --- | --- | --- |
| `cms_articles` | 15,374 | 5,572 |
| `cms_videos` | 769 | 767 |
| `cms_content_entries` | 63 | 25 |
| `cms_media_assets` | 7,940 | 7,940 |
| `cms_pages` | 32 | 0 |

去重后约 9,300 个不同链接。

**本地已有一份完整副本**：`../quitccp-media-mirror`（仓库外，不进 git），8,507 个文件全部到位，按清单校验缺失 0、大小不符 0，其中 8,420 个 md5 逐字节一致（其余 87 个是分块上传，eTag 是哈希的哈希，没法这样校验）。

## 地址映射

对象键完全一致，只换主机和前缀：

```
Supabase   …supabase.co/storage/v1/object/public/media/articles/f7/f725911b111ce6f2.jpeg
R2                       media.tuidang.org/articles/f7/f725911b111ce6f2.jpeg
                                           └────────── 同一个对象键 ──────────┘
```

---

# 第 1 步：建立镜像（零风险）

读者行为完全不变。R2 只是一张安全网，就算它不完整也没人察觉。

## 1.1 Cloudflare 侧（人工）

在 **tuidang.org 所在的那个 Cloudflare 账号**里——R2 的自定义域名必须和桶在同一个账号，这是 Cloudflare 的硬规则。

1. 左侧 **Build → Storage & databases → R2** → **Create bucket**
   建**两个**桶，位置都选 Automatic：
   - `tuidang-media` —— 媒体镜像（本方案）
   - `tuidang-logs` —— 日志存档（见 `workers/vercel-log-drain/README.md`）

   （首次使用需要开通 R2，账号上要存一张付款方式；两个桶加起来 6 GB 出头，
   在免费额度内——10 GB 存储、出站永久免费——存卡只是开通要求）

   > 两个桶一次建好，是因为申请一次 Cloudflare 权限就不容易。只建一个的话，
   > 等日志那边要用的时候还得再麻烦人一次。

2. **Manage API tokens → Create API token**，权限 **Object Read & Write**，
   范围勾上**这两个桶**（`tuidang-media` 和 `tuidang-logs`）。创建后的那一页
   会显示 **Access Key ID** 与 **Secret Access Key**，**只显示这一次**

   > ⚠️ 这里最容易漏：如果范围只勾了 `tuidang-media`，日志存档那边会拿到一个
   > 写不进去的令牌，又要重来一轮。

3. **Account ID** 在 R2 页面右侧，也可以从浏览器地址栏读：
   `dash.cloudflare.com/<Account ID>/...`

> 导航路径按 2026-10 的 Cloudflare 界面写。它改过版——旧版 R2 在一级菜单，
> 现在收在 Storage & databases 下面。找不到就直接搜 "R2"。

> ⚠️ 必须在 **tuidang.org 所在的那个账号**里建（`Chou.amen@gmail…`）。
> 同一个人可能有多个 Cloudflare 账号，各自的 Account ID 不同；建错账号的话
> `media.tuidang.org` 接不上去。

## 1.2 填进根目录 `.env.local`

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=tuidang-media
```

## 1.3 推送

```bash
node scripts/mirror-media.mjs --to ../quitccp-media-mirror      # 先拉最新（增量）
node scripts/push-media-mirror.mjs --from ../quitccp-media-mirror --dry-run
node scripts/push-media-mirror.mjs --from ../quitccp-media-mirror
```

两个脚本都是增量的，按键名和大小比对，中断再跑接着走。上传时带正确的 `content-type`——这点在磁盘上无所谓，R2 是直接发给浏览器的，一张图发成 `application/octet-stream` 就成了下载提示而不是图片。

## 1.4 接域名

**R2 → `tuidang-media` → Settings → Public access → Connect Domain** → `media.tuidang.org`

> ⚠️ **同一页里把 `r2.dev` 那个地址关掉。** 不关等于留了一个绕过 Cloudflare 的后门，而且它[官方说明是测试用的](https://developers.cloudflare.com/r2/buckets/public-buckets/)，每秒几百请求就返回 429——正好是被攻击时最糟的表现。

## 1.5 打开兜底

Vercel 环境变量：

```
NEXT_PUBLIC_MEDIA_MIRROR_HOST=media.tuidang.org
```

重新部署。`lib/media-failover.ts` 会在 `<head>` 里内联一段捕获阶段的监听器：**主机取不到图时，当场改到镜像重试**。

这段代码已经写好并上线了，变量不设就一个字都不输出。它挂在 `<head>` 而不是做成组件，因为图片在 HTML 解析时就开始加载，可能在 React 水合之前很久就失败了。

## 1.6 验证

- [ ] R2 对象数 = 8,507，总大小 ≈ 6,039 MB
- [ ] `curl -I https://media.tuidang.org/articles/f7/f725911b111ce6f2.jpeg` → 200，`image/jpeg`
- [ ] 页面 `<head>` 里出现 `id="media-failover"` 的脚本
- [ ] 浏览器里屏蔽 `supabase.co` 之后刷新文章页，图片仍然显示（走了镜像）

## 1.7 退路

删掉 `NEXT_PUBLIC_MEDIA_MIRROR_HOST`，重新部署。一切回到今天的样子。

---

# 第 2 步：R2 变成主要来源

这一步才真正兑现「读者不碰 Supabase」。

## 2.1 不要去数据库里批量改地址

15,374 篇文章的正文里写满了 Supabase 地址。去数据库里批量替换是一次又大又险的迁移，而且一旦要回退就得再来一次。

**改写放在输出那一层**，一个函数的事，随时可以关掉。

## 2.2 要改写的位置

媒体地址从三个地方流到页面上：

| 位置 | 说明 |
| --- | --- |
| 结构化字段 | `cover_image`、`cover_image_alt` 等，经 `lib/public-content.ts` 出来 |
| 正文 markdown | `components/public/MarkdownBody.tsx` 渲染，正文里直接写着 `<img src>` |
| 页面区块 JSON | `cms_content_entries` 与 `cms_pages` 的 blocks |

做法：写一个 `toMediaUrl(url)`，把 `…supabase.co/storage/v1/object/public/<bucket>/` 换成 `https://media.tuidang.org/`，在上面三处出口统一调用。未配置镜像主机时原样返回，所以这段改动本身也是可开关的。

## 2.3 把兜底方向反过来

现在是「Supabase 取不到 → 退到 R2」。第 2 步之后要改成「**R2 取不到 → 退回 Supabase**」。

这样任何一边挂了另一边都接得住。改 `lib/media-failover.ts` 里 `from` 和 `to` 两个常量的方向即可。

## 2.4 验证

- [ ] 文章页 HTML 里搜不到 `supabase.co`
- [ ] 首页、新闻页、视频页、资料页各抽查一个，图片正常
- [ ] 正文里插图的文章抽查一篇（markdown 那条路）
- [ ] 浏览器里屏蔽 `media.tuidang.org`，图片应当退回 Supabase 仍然显示

## 2.5 退路

删掉 `NEXT_PUBLIC_MEDIA_MIRROR_HOST`，改写函数自动变成恒等函数，回到第 1 步状态。

---

# 第 3 步：把桶改成私有（最终收口）

**做这一步之前，第 2 步必须已经稳定运行一段时间**，并确认没有任何地方还在引用 Supabase 地址。

## 3.1 为什么必须做

攻击者早就知道那个地址——它在每一个缓存页面里、在搜索引擎索引里、在网页存档里。**第 2 步只是让站点不再指向它，旧地址仍然有效。**

改成私有之后：

```
改前  GET …/public/media/audio/xxx.mp3  →  200，吐出 42 MB    ← 我们付流量费
改后  GET …/public/media/audio/xxx.mp3  →  400，几百字节      ← 攻击失去价值
```

这不是「拦截请求」，是**让请求没有价值**。

## 3.2 ⚠️ 要改的 5 处（这份清单就是本文档的由来）

代码里依赖「桶是公开的」这件事，只有这 5 处，全部调用 `getPublicUrl`：

| # | 文件 | 行 | 现在做什么 | 改成什么 |
| --- | --- | --- | --- | --- |
| 1 | `app/api/admin/content/uploads/sign/route.ts` | 74 | 签发上传票据时顺便算出公开地址 | 返回 R2 地址 |
| 2 | `app/api/admin/content/uploads/register/route.ts` | 63 | 登记进 `cms_media_assets` 时存公开地址 | 存 R2 地址 |
| 3 | `app/api/admin/content/videos/cover-from-source/route.ts` | 61 | 自动抓取的视频封面存公开地址 | 存 R2 地址 |
| 4 | `scripts/backfill-media-library.mjs` | 84 | 一次性回填脚本 | 顺手改 |
| 5 | `scripts/build-org-profile-pdf.ts` | 230 | 生成机构简介 PDF 的脚本 | 顺手改 |

**另外要确认的两处**（不调 `getPublicUrl`，但依赖地址可直接访问）：

- `components/admin/MediaLibrary.tsx`（202、382、390 行）——后台图片库用 `row.url` 直接显示缩略图。地址换成 R2 之后自然可用，**但要实测确认**。
- `components/admin/ImagePickerModal.tsx`——选图弹窗同理。

## 3.3 ⚠️ 顺序不能反：`getPublicUrl` 失败时不报错

**这 5 处代码必须在桶改私有之前就改完**，不能反过来。原因是实测出来的：

| 在私有桶上测 | 结果 |
| --- | --- |
| `createSignedUploadUrl` 签发上传票据 | ✅ 照常工作 |
| `uploadToSignedUrl` 直传字节 | ✅ 照常工作 |
| **`getPublicUrl` 返回地址** | **照样返回，但那个地址访问是 400** |
| `createSignedUrl` 签名下载 | ✅ 200，内容正确 |

`getPublicUrl` **不抛错、不返回 null**——它高高兴兴地给你一个用不了的地址。

所以如果先把桶改私有：上传会「成功」，编辑看到「上传完成」，数据库里存下一个死地址，页面上是一张裂图，**而且全程没有任何错误提示**。等发现的时候，已经有一批内容带着死地址存进去了。

**正确顺序**：先改完 5 处 → 确认新上传存的是 R2 地址 → 再把桶改私有。

（顺带：第 5 条说明后台预览还有一条退路——如果某处暂时拿不到 R2 地址，可以用 `createSignedUrl` 发一个有时效的签名地址。不是首选，但不至于卡住。）

## 3.4 上传流程不受影响

**Supabase 的签名上传票据对私有桶照常工作**（上表第 1、2 条实测确认）。编辑的上传体验完全不变：

```
编辑点上传
  → 浏览器拿签名票据（不变）
  → 字节直接传到 Supabase（不变，不经过我们的服务器，所以大文件也传得动）
  → 注册接口登记进数据库
        ↳ 服务器顺手把这个对象复制到 R2    ← 新增
  → 每小时一次增量同步                      ← 兜底
```

Supabase Storage 变成一个「只进不出」的中转站：编辑传进去，系统立刻复制到 R2，读者只从 R2 取。

**为什么是服务器复制，不是浏览器传两份**：浏览器传两份会让编辑等两倍时间。图片平均只有 0.29 MB，服务器拉一份再推一份也就一两秒，编辑无感；最大的文件 53 MB 也在函数时限内。

**为什么还要每小时兜底**：R2 那一步**绝不能让上传失败**。R2 抽风时文件照样存进 Supabase、照样能用，只是暂时没镜像——下一轮自动补上。站里已有 cron 机制（`/api/cron/santui`、`/api/cron/search`），照着加一个即可。

## 3.5 缓存页面的过渡

已经缓存的公开页面里写的还是 Supabase 地址。第 2 步之后新生成的页面都是 R2 地址，旧的会随缓存过期（`revalidate = 300`）自然换掉。

**不要为此去点「强制刷新全站缓存」**——那会丢掉全部 15,374 篇文章的缓存，下一个访问每个页面的人都要阻塞等一次数据库渲染，正是 10-13 那条因果链的起点。等它自然过期。

这也是第 3 步必须排在第 2 步**之后一段时间**的原因。

## 3.6 验证

- [ ] **改桶之前**：5 处代码全部改完，且新上传的文件在 `cms_media_assets` 里存的确实是 R2 地址（这一条不过关就不要动桶）
- [ ] 后台图片库、选图弹窗缩略图正常
- [ ] 编辑完整走一遍：上传图片 → 插入文章 → 发布 → 公开页面显示正常
- [ ] 桶改私有后：`curl -I …/storage/v1/object/public/media/<任一文件>` → 400 或 404
- [ ] 公开页面全部正常（此时已无任何地方引用 Supabase 地址）

## 3.7 退路

Supabase 后台把桶改回 public。地址立刻恢复有效。代码里那 5 处存的是 R2 地址，不受影响。

---

## 常见疑问

**编辑上传的图什么时候出现在 R2？**
第 3 步做完之后：**编辑看到「上传完成」时就有了**（服务器在注册那一步复制过去）。万一那次复制失败，一小时内由定时任务补上。

**最终每天是怎么跑的？** 见开头的「最终状态」一节。

**桶改成私有之后，还能照常上传吗？**
能，实测确认过（见 3.3 的表）。签名上传票据对私有桶照常工作，编辑的操作一步都不变。唯一变的是「上传完存下来的地址」——那要改成 R2 地址，也就是 3.2 那 5 处。

**R2 和 Supabase 的内容是不是完全一样？**
是，对象键一致、逐字节一致。本地那份副本校验过：缺失 0、大小不符 0、8,420 个 md5 完全一致。

**数据库里还会看到 Supabase 地址吗？**
历史数据会（我们不去批量改），新上传的不会。公开页面上看不到——改写发生在输出那一层。

**有没有盖不住的地方？**
有一个：`<a href>` 后面的 PDF 和 zip 是**导航**不是子资源，浏览器不向页面报告失败，浏览器端的兜底监听器听不见。首页「下载机构简介 PDF」就是一个。这些要在源头改地址——第 2 步的改写函数覆盖到它们就行。

---

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `scripts/mirror-media.mjs` | Supabase → 本地，增量、可中断 |
| `scripts/push-media-mirror.mjs` | 本地 → R2，增量、可反复跑 |
| `apps/web/src/lib/media-failover.ts` | 浏览器端兜底切换（已上线，变量未设时不输出） |
| `../quitccp-media-mirror` | 本地完整副本，6 GB，仓库外 |
| `docs/implementation/attack-solution/tuidang.org DDoS 事件与防御.md` | 事件全貌与其它加固 |
