# quitccp-stats（访问统计 Worker）

读者浏览器发来的 beacon 由它接收，每次浏览写进 Workers Analytics Engine 的一个数据点（数据集 `quitccp_hits`，保留 3 个月）。
方案和隐私约束见 `docs/implementation/site-analytics-plan.md`。

- 地址：`https://stats.tdinfo.org/hit`（custom domain）
- KV：`quitccp-stats-salts`，存每日盐，2 天后过期
- 只收 `SITES` 里的 Origin；目前只有中文站

部署和 vercel-log-drain 一样用 API token，不用 `wrangler login`：

```bash
set -a; . ../../.env.local; set +a
npx wrangler deploy
```

看原始数据（Analytics Engine SQL API）：

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data "SELECT blob2, SUM(_sample_interval) AS views FROM quitccp_hits WHERE timestamp > NOW() - INTERVAL '1' DAY GROUP BY blob2 ORDER BY views DESC LIMIT 20"
```

以 `/__` 开头的路径是测试数据，汇总时会被排除。
