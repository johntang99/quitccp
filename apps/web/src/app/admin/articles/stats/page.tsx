import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getArticleStats } from "@/lib/admin/article-stats";

export default async function ArticleStatsPage() {
  const user = await requireAdminSessionUser();
  const stats = await getArticleStats(user.email);
  const mapped = stats.byCategory.reduce((sum, row) => sum + row.count, 0);
  const peakYear = Math.max(1, ...stats.byYear.map((row) => row.count));

  return (
    <AdminShell user={user}>
      <ArticleTabs active="stats" />

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>总览</h3>
        <div className="stat-grid">
          <div className="stat">
            <div className="n">{stats.total.toLocaleString()}</div>
            <div className="k">文章总数</div>
          </div>
          {stats.byStatus.map((row) => (
            <div className="stat" key={row.key}>
              <div className="n">{row.count.toLocaleString()}</div>
              <div className="k">{row.label}</div>
            </div>
          ))}
          {stats.bySection.map((row) => (
            <div className="stat" key={row.key}>
              <div className="n">{row.count.toLocaleString()}</div>
              <div className="k">{row.label}区</div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>按分类</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>分类</th>
              <th style={{ width: "40%" }}>占比</th>
              <th style={{ textAlign: "right" }}>篇数</th>
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
                    <b>{row.count.toLocaleString()}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{pct}%</div>
                  </td>
                  <td>
                    <Link className="admin-btn admin-btn-sm" href={`/admin/articles?category=${row.slug}`}>
                      查看
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <b>合计</b>
              </td>
              <td />
              <td style={{ textAlign: "right" }}>
                <b>{mapped.toLocaleString()}</b>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          一篇文章可归多个分类，各分类之和可能大于总数。
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>按发布年份（近 12 年）</h3>
        <div className="spark">
          {stats.byYear.map((row) => (
            <i
              key={row.year}
              className={row.count > peakYear * 0.6 ? "hi" : undefined}
              style={{ height: `${Math.max(4, (row.count / peakYear) * 100)}%` }}
              title={`${row.year}：${row.count} 篇`}
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
        <h3 style={{ marginTop: 0 }}>需要处理</h3>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          不是错误，是迁移一万五千篇旧文留下的空缺。点「去处理」会打开筛选好的列表。
        </p>
        <table className="admin-table">
          <tbody>
            {stats.gaps.map((gap) => (
              <tr key={gap.key}>
                <td>
                  <b>{gap.label}</b>
                </td>
                <td style={{ textAlign: "right" }}>
                  <b>{gap.count.toLocaleString()}</b>
                </td>
                <td style={{ width: 1 }}>
                  <Link className="admin-btn admin-btn-sm" href={gap.href}>
                    去处理
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
