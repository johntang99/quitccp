import Link from "next/link";
import { t } from "@/lib/i18n";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getArticleStats } from "@/lib/admin/article-stats";
import { formatNumber } from "@/lib/format";

export default async function ArticleStatsPage() {
  const user = await requireAdminSessionUser();
  const stats = await getArticleStats(user.email);
  const mapped = stats.byCategory.reduce((sum, row) => sum + row.count, 0);
  const peakYear = Math.max(1, ...stats.byYear.map((row) => row.count));

  return (
    <AdminShell user={user}>
      <ArticleTabs active="stats" />

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.stats.overview")}</h3>
        <div className="stat-grid">
          <div className="stat">
            <div className="n">{formatNumber(stats.total)}</div>
            <div className="k">{t("admin.stats.total")}</div>
          </div>
          {stats.byStatus.map((row) => (
            <div className="stat" key={row.key}>
              <div className="n">{formatNumber(row.count)}</div>
              <div className="k">{row.label}</div>
            </div>
          ))}
          {stats.bySection.map((row) => (
            <div className="stat" key={row.key}>
              <div className="n">{formatNumber(row.count)}</div>
              <div className="k">{t("admin.stats.sectionSuffix", { label: row.label })}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.stats.byCategory")}</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("admin.stats.col.category")}</th>
              <th style={{ width: "40%" }}>{t("admin.stats.col.share")}</th>
              <th style={{ textAlign: "right" }}>{t("admin.stats.col.count")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stats.byCategory.map((row) => {
              const pct = mapped > 0 ? Math.round((row.count / mapped) * 100) : 0;
              return (
                <tr key={row.slug} style={row.count === 0 ? { opacity: 0.55 } : undefined}>
                  <td>
                    <b>{row.name}</b>
                    <div className="muted" style={{ fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace" }}>
                      {row.slug}
                    </div>
                  </td>
                  <td>
                    <div className="bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <b>{formatNumber(row.count)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{pct}%</div>
                  </td>
                  <td>
                    <Link className="admin-btn admin-btn-sm" href={`/admin/articles?category=${row.slug}`}>
                      {t("admin.stats.view")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <b>{t("admin.stats.sum")}</b>
              </td>
              <td />
              <td style={{ textAlign: "right" }}>
                <b>{formatNumber(mapped)}</b>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          {t("admin.stats.multiCategoryNote")}
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.stats.byYear")}</h3>
        <div className="spark">
          {stats.byYear.map((row) => (
            <i
              key={row.year}
              className={row.count > peakYear * 0.6 ? "hi" : undefined}
              style={{ height: `${Math.max(4, (row.count / peakYear) * 100)}%` }}
              title={t("admin.stats.yearTitle", { year: row.year, count: row.count })}
            />
          ))}
        </div>
        <div className="spark-labels">
          {stats.byYear.map((row) => (
            <span key={row.year}>{row.year.slice(2)}</span>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.stats.todo")}</h3>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          {t("admin.stats.todoNote")}
        </p>
        <table className="admin-table">
          <tbody>
            {stats.gaps.map((gap) => (
              <tr key={gap.key}>
                <td>
                  <b>{gap.label}</b>
                </td>
                <td style={{ textAlign: "right" }}>
                  <b>{formatNumber(gap.count)}</b>
                </td>
                <td style={{ width: 1 }}>
                  <Link className="admin-btn admin-btn-sm" href={gap.href}>
                    {t("admin.stats.goFix")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
