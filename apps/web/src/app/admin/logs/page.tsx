import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { recentLogHours, type LogHourRow } from "@/lib/admin/log-rollup";
import { formatNumber } from "@/lib/format";

/**
 * What the public site actually served, hour by hour.
 *
 * It reads `cms_log_hourly`, not R2. The raw NDJSON is tens of megabytes an
 * hour and expires after 14 days; this table is 24 small rows a day, kept
 * forever. So this page answers "was that week normal" instantly and for as
 * far back as the site has run, and `scripts/read-drain-logs.mjs` answers
 * "what did that one request look like" for as long as the raw archive holds.
 *
 * Nothing here is derived from reader IPs. See the note in migration 027.
 */
export const dynamic = "force-dynamic";

const HOURS = 48;

const num = (n: number) => formatNumber(n);

function bytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** UTC, like the archive and the rollup. Converting silently is how you read the wrong hour. */
function hourLabel(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:00`;
}

function sum(rows: LogHourRow[], pick: (r: LogHourRow) => number) {
  return rows.reduce((total, r) => total + pick(r), 0);
}

export default async function AdminLogsPage() {
  const user = await requireAdminSessionUser();
  /* Same gate as the defence panel; the sidebar hides the link too, and this
     is the check that matters. */
  if (!can(user, "publish.revalidate")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>访问日志</h2>
          <p className="dash-note">这个页面只对站点管理员开放。</p>
        </section>
      </AdminShell>
    );
  }

  const rows = await recentLogHours(HOURS);
  const day = rows.slice(0, 24);
  const requests = sum(day, (r) => r.requests);
  const errors = sum(day, (r) => r.status_5xx) + sum(day, (r) => r.errors);
  const notFound = sum(day, (r) => r.status_4xx);
  const hit = sum(day, (r) => r.cache_hit);
  const served = hit + sum(day, (r) => r.cache_miss) + sum(day, (r) => r.cache_other);
  const hitRate = served > 0 ? Math.round((hit / served) * 100) : null;
  const archived = sum(rows, (r) => r.bytes);
  const busiest = Math.max(1, ...rows.map((r) => r.requests));

  /* Top routes across the whole window rather than the latest hour: one hour
     of a quiet night says nothing, and the shape of the traffic is the point. */
  const routes = new Map<string, number>();
  for (const row of rows) {
    for (const entry of row.top_paths ?? []) {
      routes.set(entry.path, (routes.get(entry.path) ?? 0) + entry.n);
    }
  }
  const topRoutes = [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>访问日志</h2>
        <p className="dash-note">
          公开站点每小时服务了什么。原始日志存在 Cloudflare R2，保留 14 天；这里是从中汇总出来的
          每小时计数，永久保留 —— 所以「上周二正常吗」这种问题一年后还答得出来，而「某一条请求长什么样」
          要在 14 天内用 <code>scripts/read-drain-logs.mjs</code> 去查原始记录。
          时间一律 UTC，和存档的分区方式一致。这里不含任何读者 IP。
        </p>

        {rows.length === 0 ? (
          <p className="dash-alert">
            <b>还没有汇总数据。</b>可能是 Vercel 的 Log Drain 还没建起来（见
            <code>workers/vercel-log-drain/README.md</code>），也可能是每小时的汇总任务还没跑过第一次 ——
            它在每小时的第 12 分运行。后台首页「站点防护」面板里的「日志存档」那一项会说是哪一种。
          </p>
        ) : (
          <>
            <div className="dash-stats">
              <div className="dash-stat"><b>{num(requests)}</b><span>近 24 小时请求</span></div>
              <div className="dash-stat"><b>{hitRate === null ? "—" : `${hitRate}%`}</b><span>CDN 缓存命中</span></div>
              <div className="dash-stat"><b>{num(notFound)}</b><span>4xx</span></div>
              <div className="dash-stat"><b>{num(errors)}</b><span>5xx 与错误行</span></div>
              <div className="dash-stat"><b>{bytes(archived)}</b><span>近 {rows.length} 小时存档</span></div>
            </div>
            {errors > 0 ? (
              <p className="dash-alert">
                <b>近 24 小时有 {num(errors)} 条 5xx 或错误记录。</b>
                正常值是 0。用 <code>node scripts/read-drain-logs.mjs --hours 24 --status 500</code>
                　看是哪些请求 —— 原始记录只保留 14 天，过了就查不到了。
              </p>
            ) : null}
          </>
        )}
      </section>

      {rows.length > 0 ? (
        <>
          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>逐小时</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>小时 (UTC)</th>
                    <th style={{ width: 200 }}>请求</th>
                    <th style={{ width: 60 }}>2xx</th>
                    <th style={{ width: 60 }}>3xx</th>
                    <th style={{ width: 60 }}>4xx</th>
                    <th style={{ width: 60 }}>5xx</th>
                    <th style={{ width: 90 }}>缓存命中</th>
                    <th style={{ width: 80 }}>其他行</th>
                    <th style={{ width: 80 }}>存档</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const servedRow = row.cache_hit + row.cache_miss + row.cache_other;
                    const rate = servedRow > 0 ? Math.round((row.cache_hit / servedRow) * 100) : null;
                    return (
                      <tr key={row.hour}>
                        <td>{hourLabel(row.hour)}</td>
                        <td>
                          {/* A bar rather than a chart library: one number per
                              row, and the shape is the only thing being read. */}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "100%" }}>
                            <span
                              aria-hidden
                              style={{
                                display: "inline-block",
                                height: 8,
                                borderRadius: 4,
                                background: row.status_5xx > 0 ? "#B42318" : "#157347",
                                opacity: 0.75,
                                width: `${Math.max(2, (row.requests / busiest) * 120)}px`
                              }}
                            />
                            <span>{num(row.requests)}</span>
                          </span>
                        </td>
                        <td>{num(row.status_2xx)}</td>
                        <td>{num(row.status_3xx)}</td>
                        <td style={{ color: row.status_4xx > 0 ? "#B54708" : undefined }}>{num(row.status_4xx)}</td>
                        <td style={{ color: row.status_5xx > 0 ? "#B42318" : undefined }}>{num(row.status_5xx)}</td>
                        <td>{rate === null ? "—" : `${rate}%`}</td>
                        <td>{num(row.other_lines)}</td>
                        <td>{bytes(row.bytes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="dash-note">
              「其他行」是没有 <code>proxy</code> 字段的记录 —— 主要是构建日志。单独计数是因为一次部署
              能在一分钟内产生几百行，混进请求数里会让每次发布看起来都像一次流量高峰。
            </p>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>访问最多的路由（近 {rows.length} 小时）</h3>
            <p className="dash-note" style={{ marginTop: 0 }}>
              是<b>路由模式</b>不是具体网址 —— <code>news/[slug]</code> 而不是 15,374 篇文章里的某一篇。
              否则每小时的前十名都是十篇不同的文章，看不出流量落在站点的哪一块。
            </p>
            <table className="admin-table" style={{ maxWidth: 560, fontVariantNumeric: "tabular-nums" }}>
              <thead><tr><th>路由</th><th style={{ width: 90 }}>次数</th></tr></thead>
              <tbody>
                {topRoutes.map(([route, n]) => (
                  <tr key={route}><td><code>{route}</code></td><td>{num(n)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
