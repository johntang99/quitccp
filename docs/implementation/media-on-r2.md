# 媒体走 R2：现在是怎么运转的

> 这份文档写于 2026-10-15，媒体从 Supabase Storage 搬到 Cloudflare R2 当天。
> `media-mirror-plan.md` 是当初的方案（其中「桶改私有」那一步**还没做**），
> 这一份是**落地之后的实际状态**，以及为什么是这样。

---

## 一句话

媒体文件两边都有。数据库里存 Supabase 地址，**渲染时**换成 `media.tdinfo.org`
发给读者；R2 取不到时，浏览器自动退回 Supabase。

```
          ┌─ 主：media.tdinfo.org   （R2 + Cloudflare 缓存 + 限速）
读者 ─────┤
          └─ 备：…supabase.co       （自动回落，读者无感）
```

---

## 为什么不是 tuidang.org 的子域名

R2 要求**桶和它的自定义域名在同一个 Cloudflare 账户**。持有 tuidang.org 的那个
账户（TD Account）里，没人有账单权限 —— 开通 R2 的按钮是灰的，Administrator
角色明确「不能管理账单资料」，而「make purchases」只给 Super Administrator。

注册 `tdinfo.org` 到我们自己的账户，这个依赖整个消失了。附带两个好处：媒体域名
是**唯一真正跑在 Cloudflare WAF 后面**的东西（tuidang.org 在 Cloudflare 上只做
DNS，网站托管在 Vercel），而且顺着 tuidang.org 枚举子域名找不到它。

**但这不是安全措施。** WHOIS、被动 DNS、证书透明度日志都能把两个域名连起来。
镜像的意义是**可用性** —— Supabase Storage 再出 544 时图片还在 —— 不是隐蔽。

---

## 基础设施

| | |
| --- | --- |
| Cloudflare 账户 | `507fda2c85cde89822525a602e5e538d`（John 自己的） |
| 域名 | `tdinfo.org`，Cloudflare Registrar |
| 媒体桶 | `tuidang-media` · Standard · Eastern North America |
| 日志桶 | `tuidang-logs`（给日志存档用，见 `workers/vercel-log-drain/`） |
| 自定义域名 | `media.tdinfo.org` · 最低 TLS 1.2 · 橙色云代理 |
| API 令牌 | Account API token（不是 User token）· Object Read & Write · 只勾这两个桶 |
| 限速规则 | URI Path contains `/` · 2000 次/10 秒 · 按 IP · Block 10 秒 |

### ⚠️ Public Development URL（r2.dev）必须保持关闭

开了它，桶就能从 `r2.dev` 直接访问，**绕过所有 WAF 规则和限速**。桶默认就是关的，
保持原样即可 —— 那个蓝色的 Enable 按钮永远不要点。

### 免费套餐的三个限制（限速规则）

实际点进去才发现的，文档上不写：

- **Field 只有 URI Path** —— 没有 Hostname。不要紧，这个 zone 下只有媒体
- **Period 只有 10 秒** —— 窗口短，对正常的页面加载突发不宽容，所以门槛要放宽
- **Action 只有 Block** —— 没有 Managed Challenge。读者大量用 VPN，同一出口 IP
  后面可能坐着很多人，硬封会误伤，这也是门槛定在 2000 的原因

---

## 代码：三个文件，三件事

### `lib/media-mirror.ts` —— 改写规则的唯一来源

```
//…supabase.co/storage/v1/object/public/media/   →   //media.tdinfo.org/
```

只匹配 `/object/public/`。签名地址（`/object/sign/`）带着针对单个对象的令牌，
在镜像上毫无意义，所以**故意不动** —— 桶改私有之后后台用的就是那种形式。

### `supabase/admin-client.ts` → `createSupabasePublicClient()`

把改写作用在**响应的文本**上，而不是具名字段上。媒体地址不只住在具名字段里，
它还在 markdown 正文里、在页面 JSON 的任意层级里。走结构就要点名字段，下一个人
加的字段会被静悄悄漏掉。

**只有公开只读的六个 loader 用它**：`public-content`、`public-settings`、
`public-theme`、`search-repository`、`search-substring`、`section-nav`。

**后台一个都不用。** 后台读出来的值会进表单、保存时写回去 —— 在那边改写等于
一次一条地把库里的行悄悄迁成镜像地址，那就赔掉了下面这条性质。

### `lib/media-failover.ts` —— 方向已反转

原来是「Supabase 失败 → 换镜像」。服务端现在送出去的就是镜像地址，那个方向
再也匹配不上，所以改成「镜像失败 → 回落 Supabase」。

它和服务端改写**从同一个函数取规则**。两份各写一遍然后慢慢走偏的话，症状只是
「图一直是坏的」，完全不会指向原因。

脚本内联在 `<head>` 里而不是做成 React 组件：图片在 HTML 被解析时就开始加载，
可能在 React 挂载之前就已经失败了，`useEffect` 挂得太晚，听不到。

---

## 最要紧的一条性质：可逆

**数据库里一个字都没改。** 删掉 Vercel 上的 `NEXT_PUBLIC_MEDIA_MIRROR_HOST`，
重新部署，整站下一次渲染就全部回到 Supabase。

这就是为什么**新上传也继续存 Supabase 地址**，而不是存 R2 地址：

> 把「对象在哪个桶里」当数据，把「从哪个域名发出去」当配置。

混在一起，库里就有两种行 —— 紧急开关只能救回一半。

---

## 新上传的文件怎么进 R2

浏览器是**直传 Supabase** 的（Vercel 请求体上限 4.5MB，远低于编辑被允许的
200MB），所以镜像一直落后到有人想起来跑同步脚本。这个缺口不是理论上的：
10-15 这天首页上有十三张图在 Storage 里有、镜像里没有。

现在 `uploads/register` 和 `videos/cover-from-source` 在登记完成后，用 `after()`
把对象复制进 R2。三条刻意的选择：

1. **放在 `after()` 里**，编辑不用等 —— 对象已在 Storage、行已写好，上传本身
   已经成功了，不该为了镜像让人多等一个 40MB 视频的时间
2. **永远不让上传失败** —— 复制不成就记日志，交给同步脚本兜底
3. **超过 100MB 不内联复制** —— 签 S3 的 PUT 要先算整个 body 的哈希，没法流式，
   大文件不拿函数内存去赌

兜底仍然需要：`node scripts/mirror-media.mjs --to ../quitccp-media-mirror` 是
增量的，跑一次就能补上任何漏掉的。

---

## 编辑那边有什么变化

**没有变化。** 上传的步骤、看到的地址、媒体库的样子，全都和以前一样 ——
后台读的是未改写的数据，显示的是 Supabase 地址，而桶仍然是公开的。

唯一的区别是后台看不见的：登记完成之后多了一次后台复制。

---

## 两个踩过的坑

### 一、Cloudflare 把 404 缓存 4 小时

R2 对不存在的对象返回 404，带 `cache-control: max-age=14400`。**在文件上传之前
去探测它的地址，会把那个地址毒化 4 小时。**

验证新文件时特别容易中招 —— 先同步再验证，不要反过来。中了的话：
Cloudflare → Caching → Configuration → Purge Cache → Custom Purge → URL。

### 二、用 `fetch()` 测 R2 会被 CORS 挡，但 `<img>` 不会

桶没有配 CORS 策略，所以从页面里 `fetch('https://media.tdinfo.org/...')` 会报
`ERR_FAILED`。**这不代表图片坏了** —— `<img>`、`<video>` 跨域加载根本不需要 CORS。

要验证图片是否真的显示，查 `img.complete && img.naturalWidth > 0`，不要用 fetch。

---

## 落地当天的验证数据（2026-10-15）

| 项 | 结果 |
| --- | --- |
| R2 对象数 | 8,548 = Supabase 8,548，**字节差 0** |
| 哈希抽样（含最大的 5 个 ~53MB 文件） | 25/25 一致 |
| 公开页面（含深分页第 2 / 500 / 1154 页） | 残留 Supabase **全部为 0** |
| 视频页图片 | 46 张全部成功解码，45 张来自镜像 |
| 外站图床（i.epochtimes.com 等） | 原样保留，没有被误改 |
| Range 请求（视频拖进度条） | HTTP 206 正常，且仍走缓存 |
| 限速规则 | 第 2005 个请求开始 429（门槛 2000），10 秒后自动恢复 |
| 正常页面加载（60 并发） | 全部 200，无误伤 |

---

## 还没做的：桶改私有

`media-mirror-plan.md` 的第 3 步。做了之后：

- **得到**：堵住「攻击者用旧快照里的 Supabase 地址消耗配额」这条路
- **失去**：Supabase 这条腿 —— 回落机制会把一张坏图换成另一张坏图，**R2 成为
  媒体单点**

**这两件事是互斥的，必须二选一。** 前提是那 5 处 `getPublicUrl` 必须先改完：
私有桶上它照样返回一个地址，只是那个地址是死的 —— 上传会「成功」，编辑看到
「完成」，数据库里存下一个打不开的地址，**全程没有任何报错**。

现在不急。渲染改写之后页面上已经不出现 Supabase 地址了，增量价值没有「保住
两条腿」那么值钱。

---

## 相关文件

```
apps/web/src/lib/media-mirror.ts            改写规则（唯一来源）
apps/web/src/lib/media-mirror.test.ts       10 个用例
apps/web/src/lib/media-failover.ts          浏览器端回落（方向已反转）
apps/web/src/lib/supabase/admin-client.ts   createSupabasePublicClient
apps/web/src/lib/admin/media-mirror-upload.ts  上传后复制进 R2
scripts/mirror-media.mjs                    Supabase → 本地，增量
scripts/push-media-mirror.mjs               本地 → R2，增量
workers/vercel-log-drain/                   日志存档（用 tuidang-logs 桶）
docs/implementation/media-mirror-plan.md    当初的方案与第 3 步清单
```

---

## 怎么知道这套还在运转

见 `selfcheck-and-alerts.md`。后台「站点防护」面板里有三项是关于这份文档的：
镜像开关是否还在、最近 3 个上传是否已进 R2、渲染出来的页面里是否还有指向
Supabase 的图片地址。坏掉会发邮件。
