import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getVideoStats } from "@/lib/admin/video-stats";
import { formatNumber } from "@/lib/format";

/** 视频统计 — the counts, and the two numbers worth acting on. */
export default async function VideoStatsPage() {
  const user = await requireAdminSessionUser();
  const stats = await getVideoStats();
  const maxCategory = Math.max(1, ...stats.byCategory.map((row) => row.count));
  const maxYear = Math.max(1, ...stats.byYear.map((row) => row.count));
  const hours = Math.round(stats.totalSeconds / 3600);
  const unreachable = stats.byHost
    .filter((row) => !row.reachable && row.key !== "none")
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <AdminShell user={user}>
      <VideoTabs active="stats" />

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.vstats.totals")}</h3>
        <div className="stat-grid">
          <div className="stat">
            <div className="muted" style={{ fontSize: 12 }}>{t("admin.vstats.totalVideos")}</div>
            <div className="n">{formatNumber(stats.total)}</div>
          </div>
          {stats.byStatus.map((row) => (
            <div className="stat" key={row.key}>
              <div className="muted" style={{ fontSize: 12 }}>{row.label}</div>
              <div className="n">{formatNumber(row.count)}</div>
            </div>
          ))}
          <div className="stat">
            <div className="muted" style={{ fontSize: 12 }}>{t("admin.vstats.knownDuration")}</div>
            <div className="n">{t("admin.vstats.hours", { n: formatNumber(hours) })}</div>
          </div>
        </div>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          {t("admin.vstats.durationNote")}
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.vstats.todo")}</h3>
        <div className="stat-grid">
          {stats.gaps.map((gap) => (
            <a className="stat" key={gap.key} href={gap.href} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="muted" style={{ fontSize: 12 }}>{gap.label}</div>
              <div className="n" style={{ color: gap.count > 0 ? "#b42318" : undefined }}>
                {formatNumber(gap.count)}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.vstats.byHost")}</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.vstats.col.host")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.vstats.col.count")}</th>
                <th>{t("admin.vstats.col.reachable")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.byHost.map((row) => (
                <tr key={row.key}>
                  <td>
                    <a href={`/admin/videos?host=${row.key}`}>{row.label}</a>
                  </td>
                  <td style={{ textAlign: "right" }}>{formatNumber(row.count)}</td>
                  <td className="muted">{row.key === "none" ? "—" : t(row.reachable ? "admin.vstats.reachableYes" : "admin.vstats.reachableNo")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          <b>{t("admin.vstats.unreachable", { n: formatNumber(unreachable) })}</b>
          {t("admin.vstats.unreachableNote")}
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.vstats.byCategory")}</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.list.col.category")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.vcat.col.count")}</th>
                <th style={{ width: 220 }}>{t("admin.vstats.col.share")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCategory.map((row) => (
                <tr key={row.slug}>
                  <td>
                    <a href={`/admin/videos?category=${row.slug}`}>{row.name}</a>
                  </td>
                  <td style={{ textAlign: "right" }}>{formatNumber(row.count)}</td>
                  <td>
                    <div className="bar">
                      <i style={{ width: `${Math.round((row.count / maxCategory) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.vstats.byYear")}</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.vstats.col.year")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.vstats.col.count")}</th>
                <th style={{ width: 220 }}>{t("admin.vstats.col.spread")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.byYear.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td style={{ textAlign: "right" }}>{formatNumber(row.count)}</td>
                  <td>
                    <div className="bar">
                      <i style={{ width: `${Math.round((row.count / maxYear) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
