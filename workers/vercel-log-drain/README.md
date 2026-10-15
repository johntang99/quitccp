# Vercel 日志存档（Log Drain → Cloudflare R2）

Vercel 的运行时日志只留一天。2026-10-13 那场攻击之后，我们反复想问的是
「凌晨 3:40 到底在进来什么」，而等想到要问的时候，日志已经没了。

这个 Worker 把 Vercel 的日志接下来，原样写进我们自己的 R2，想留多久留多久。

## 现在的状态（2026-10-15）

**全部开通完毕**，日志正在流入 R2。

| | |
| --- | --- |
| Worker 地址 | `https://vercel-log-drain.baam-edge.workers.dev` |
| 桶 | `tuidang-logs`，保留期 14 天（lifecycle 规则 `expire-raw-logs-14d`） |
| 签名密钥 | 已写入 Worker secret；同一个值记在根目录 `.env.local` 的 `VERCEL_DRAIN_SIGNATURE_SECRET` |
| 后台可见 | `/admin/dashboard` →「站点防护」→「日志存档」，没收到数据会说 |
| Drain | 已建，名字 `quitccp`，Logs / NDJSON / Production |

部署用的是 API token（`CLOUDFLARE_API_TOKEN`），不是 `wrangler login` ——
localhost 上别的项目留下的 cookie 会把 login 的回调服务器撑爆（HTTP 431，
cookie 按主机名存、不分端口）。

## 开通步骤

第 1、2、3、5 步已经做完（2026-10-15）。留在这里是为了将来重建时照着走：

```bash
export CLOUDFLARE_API_TOKEN=…   # 见根目录 .env.local
export CLOUDFLARE_ACCOUNT_ID=…

# 1. 建桶
npx wrangler r2 bucket create tuidang-logs

# 2. 设置签名密钥（第 4 步要把同一个值填进 Vercel）
openssl rand -hex 32
cd workers/vercel-log-drain
printf '%s' "$SECRET" | npx wrangler secret put DRAIN_SIGNATURE_SECRET

# 3. 部署，拿到 workers.dev 地址
npx wrangler deploy

# 5. 保留期
npx wrangler r2 bucket lifecycle add tuidang-logs expire-raw-logs-14d logs/ --expire-days 14
```

**4. 在 Vercel 建 drain**：Team Settings → Drains → Add Drain

| 项 | 填什么 | 为什么 |
| --- | --- | --- |
| 数据类型 | Logs | |
| 项目 | quitccp | |
| **Log sources** | `lambda` `edge` `external` `redirect` `build` | **不要勾 `static`**。实测 100 条里 39 条是 static、31 条是缓存命中——它们没碰函数也没碰数据库，对事后排查几乎没用，却占三分之一的量。在这里排除是免费的，接到 Worker 里再扔就已经按 $0.50/GB 付过钱了 |
| | **也不要勾 `firewall`** | 它记的是被防火墙拒掉的请求，带 `wafAction` 和 `wafRuleId`，是攻击取证最有价值的数据——也是量最大的。攻击高峰时第 8 条规则 15 分钟命中 142 万次，折算约 **64 GB/天、$32/天**。平时关掉；真出事时临时打开一段时间 |
| Environment | `production` | preview 的日志没有留存价值 |
| Format | **NDJSON** | 一行一条，批次之间可以直接拼接；JSON 数组还要先拆外层 |
| Endpoint URL | 第 3 步拿到的 Worker 地址 | |
| Signature Verification Secret | 第 2 步生成的那个值 | Worker 靠它确认请求真的来自 Vercel |

建的时候 Vercel 会自动测一次这个端点，Worker 对带 `x-vercel-verify` 的请求
直接回 200 并把这个头原样送回，所以能一次通过。

**5. 设保留期**：Cloudflare → R2 → tuidang-logs → Settings → Object lifecycle
rules，对前缀 `logs/` 设 **14 天**后删除。

14 天是这么来的：保留期由「发现得多晚」决定，不是由「查得多勤」决定。周五
夜里出事、周一才看是 3 天；旧 WordPress 地址那个绕过，我们是隔了约 24 小时
才找出来的；想对比「这周二 vs 上周二」至少要 8 天。再往后就没人问「某条请求
长什么样」了，只会问「那阵子正常吗」——那是聚合该回答的，不是原始行。

7 天是下限，14 天是舒服的。在 R2 上这个选择几乎不花钱，所以不必为省钱压到 7 天。

## 怎么看

```bash
# 最近 3 小时
node scripts/read-drain-logs.mjs --hours 3

# 攻击那天凌晨那两个小时（时间一律 UTC）
node scripts/read-drain-logs.mjs --from 2026-10-13T03:00 --to 2026-10-13T05:00

# 只看 5xx
node scripts/read-drain-logs.mjs --hours 24 --status 500

# 只看某条路径，只要汇总不要明细
node scripts/read-drain-logs.mjs --hours 24 --path /news/ --summary
```

它会先按状态码、来源、缓存命中、防火墙动作各给一份统计，再列出现得最多的
十条路径，最后才是明细。`.env.local` 里要有和 `push-media-mirror.mjs` 同一套
R2 凭据，外加 `R2_LOG_BUCKET=tuidang-logs`。

## 花多少钱

Vercel 按**未压缩 JSON** 的字节数收 $0.50/GB，Pro 没有免费额度。实测每条
日志 470 字节、当前约 1,736 条/小时：

| | 量 | 每月 |
| --- | --- | --- |
| 排除 static 之后的当前流量 | 约 0.4 GB/月 | **约 $0.20** |
| 若防线失守、放行回到 1.2M 条/小时 | 14 GB/天 | $203 |

R2 这边：存储 $0.015/GB/月（几毛钱），**出口流量免费**，写入按 Class A 操作
计费（$4.50/百万次），每批一次写，平时一天几百次，可以忽略。

真正的风险不是平时，而是攻击一旦再次放量，这条 drain 的账单没有上限。
Vercel 的 drain 支持 sampling rule（按环境 + 路径前缀设采样百分比），需要的话
可以加一条兜底，比如生产环境只采 10%。

## 一件要你拿主意的事

日志里有 `proxy.clientIp` —— 读者的 IP。本站读者是海外华人，把他们的 IP
长期存进 R2 是一个需要你点头的决定，不是一个技术默认值。

Vercel 可以在团队层面关掉：Settings → Security & Privacy → **IP Address
Visibility**，关掉之后所有 drain 里都不再带 IP。代价是丢掉按 IP 追攻击源的
能力——而我们现有的防火墙规则恰恰是按 IP 和 JA4 指纹建的。

折中做法：平时关掉，真出事时临时打开。要我怎么设，你说。

## 验证记录（2026-10-14，本地 `wrangler dev`，用的是生产真实日志）

| 测试 | 结果 |
| --- | --- |
| 正确签名的 25 条真实日志 | 200，写入成功 |
| 错误签名 / 没有签名头 / 别的密钥签的 | 403 |
| 签名长度不同（防短路比较） | 403 |
| 签完名后被改动的 body | 403 |
| 建 drain 时的验证请求（无签名，带 `x-vercel-verify`） | 200，并原样回送该头 |
| 空 body + 正确签名 | 200 |
| GET | 405 |
| **存进 R2 的字节** | **与发出的 11,189 字节逐字节一致（sha256 相同）** |
| 对象键 | `logs/2026/10/14/09/1791971268900-451731.ndjson` |
| 读回来 | 25 行全部能 JSON.parse |

读取脚本也对着模拟的 R2 跑过完整流程：两个小时分区、100 条记录，统计结果
（200×81、301×18、404×1）与原始日志完全吻合。


## 验证记录（2026-10-15，线上 Worker）

部署到 `https://vercel-log-drain.baam-edge.workers.dev` 之后，对着真实线上
地址重跑了一遍：

| 测试 | 结果 |
| --- | --- |
| GET | 405 |
| `x-vercel-verify` 握手 | 200，并原样回送该头 |
| 错误签名 | 403 |
| 没有签名头 | 403 |
| 正确签名 | 200 |
| 写进 R2 | `logs/2026/10/15/08/…ndjson`，读回来与发出的 JSON 逐字相同 |

第一次跑前三条时拿到的是 404 —— workers.dev 的路由还没传播开。几秒之后
就正常了。重建时如果头几次请求 404，先等一会儿再试，不要以为部署失败了。


## 建 drain 时会卡住的两个地方（2026-10-15 实际踩过）

**一、密钥是 Vercel 生成的，不是你生成的。**

第 3 步那个 Signature Verification Secret 输入框**打开时就已经预填了一串**，
是 Vercel 自己生成的。文档（和这份 README 原来的写法）会让你以为是你生成一个
填进去 —— 不是。所以顺序反过来：**先从 Vercel 复制，再写进 Worker**。

```bash
# 把 Vercel 那串写进根目录 .env.local 的 VERCEL_DRAIN_SIGNATURE_SECRET，然后
cd workers/vercel-log-drain
printf '%s' "$SECRET" | npx wrangler secret put DRAIN_SIGNATURE_SECRET
```

不用重新部署，secret 立即生效。

顺带：Vercel 生成的是 32 位 base62，不是十六进制。我们原来用
`openssl rand -hex 32` 生成的是 64 位 hex。两种都行 —— HMAC 对任意字符串
都成立 —— 别因为格式不一样就以为粘错了。

**二、Test 按钮发的是带签名的真实请求，不是所有权握手。**

密钥没对上时它回 403，界面只说「Your endpoint sent a 403」，不告诉你为什么。
Worker 这边拒得完全正确，但从界面上看不出问题在哪。

分辨方法是挂实时日志看它到底发了什么：

```bash
cd workers/vercel-log-drain && npx wrangler tail --format json
```

实测抓到的：

```
POST → 403
   user-agent          VercelDrain/1.0 (+https://vercel.com/docs/drains)
   content-type        application/x-ndjson
   content-length      582
   x-vercel-signature  dd1b2a47a39e19330b80d63178f935ac4a11b811
```

带签名、带 582 字节样本数据 —— 所以不是握手。`x-vercel-verify` 那条路径只在
别的场合用。密钥同步之后同一个请求就是 200 了。

（macOS 上没有 `timeout` 命令，想给 tail 设时限得用 `gtimeout` 或者直接 Ctrl-C。）
