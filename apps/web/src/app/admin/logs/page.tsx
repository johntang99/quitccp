import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
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
          <h2 style={{ marginTop: 0 }}>{t("admin.logs.title")}</h2>
          <p className="dash-note">{t("admin.logs.adminOnly")}</p>
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
        <h2 style={{ marginTop: 0 }}>{t("admin.logs.title")}</h2>
        <p className="dash-note">
          {tRich("admin.logs.intro", { script: <code>scripts/read-drain-logs.mjs</code> })}
        </p>

        {rows.length === 0 ? (
          <p className="dash-alert">
            <b>{t("admin.logs.noData")}</b>
            {tRich("admin.logs.noDataBody", {
              readme: <code>workers/vercel-log-drain/README.md</code>
            })}
          </p>
        ) : (
          <>
            <div className="dash-stats">
              <div className="dash-stat"><b>{num(requests)}</b><span>{t("admin.logs.requests24h")}</span></div>
              <div className="dash-stat"><b>{hitRate === null ? "—" : `${hitRate}%`}</b><span>{t("admin.logs.cdnHit")}</span></div>
              <div className="dash-stat"><b>{num(notFound)}</b><span>4xx</span></div>
              <div className="dash-stat"><b>{num(errors)}</b><span>{t("admin.logs.errors")}</span></div>
              <div className="dash-stat"><b>{bytes(archived)}</b><span>{t("admin.logs.archived", { n: rows.length })}</span></div>
            </div>
            {errors > 0 ? (
              <p className="dash-alert">
                <b>{t("admin.logs.errorAlert", { n: num(errors) })}</b>
                {tRich("admin.logs.errorAlertBody", {
                  cmd: <code>node scripts/read-drain-logs.mjs --hours 24 --status 500</code>
                })}
              </p>
            ) : null}
          </>
        )}
      </section>

      {rows.length > 0 ? (
        <>
          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.logs.hourly")}</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>{t("admin.logs.col.hour")}</th>
                    <th style={{ width: 200 }}>{t("admin.logs.col.requests")}</th>
                    <th style={{ width: 60 }}>2xx</th>
                    <th style={{ width: 60 }}>3xx</th>
                    <th style={{ width: 60 }}>4xx</th>
                    <th style={{ width: 60 }}>5xx</th>
                    <th style={{ width: 90 }}>{t("admin.logs.col.cacheHit")}</th>
                    <th style={{ width: 80 }}>{t("admin.logs.col.otherRows")}</th>
                    <th style={{ width: 80 }}>{t("admin.logs.col.archived")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const servedRow = row.cache_hit + row.cache_miss + row.cache_other;
                    const rate = servedRow > 0 ? Math.round((row.cache_hit / servedRow) * 100) : null;
                    return (
                      <tr key={row.hour} data-snapshot="data">
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
              {tRich("admin.logs.otherRowsNote", { field: <code>proxy</code> })}
            </p>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.logs.topRoutes", { n: rows.length })}</h3>
            <p className="dash-note" style={{ marginTop: 0 }}>
              {tRich("admin.logs.topRoutesNote", {
                pattern: <b>{t("admin.logs.topRoutesPattern")}</b>,
                example: <code>news/[slug]</code>
              })}
            </p>
            <table className="admin-table" style={{ maxWidth: 560, fontVariantNumeric: "tabular-nums" }}>
              <thead><tr><th>{t("admin.logs.col.route")}</th><th style={{ width: 90 }}>{t("admin.logs.col.count")}</th></tr></thead>
              <tbody>
                {topRoutes.map(([route, n]) => (
                  <tr key={route} data-snapshot="data"><td><code>{route}</code></td><td>{num(n)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
