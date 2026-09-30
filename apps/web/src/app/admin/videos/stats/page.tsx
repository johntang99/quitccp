import { AdminShell } from "@/components/admin/AdminShell";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getVideoStats } from "@/lib/admin/video-stats";

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
        <h3 style={{ marginTop: 0 }}>总量</h3>
        <div className="stat-grid">
          <div className="stat">
            <div className="muted" style={{ fontSize: 12 }}>视频总数</div>
            <div className="n">{stats.total.toLocaleString()}</div>
          </div>
          {stats.byStatus.map((row) => (
            <div className="stat" key={row.key}>
              <div className="muted" style={{ fontSize: 12 }}>{row.label}</div>
              <div className="n">{row.count.toLocaleString()}</div>
            </div>
          ))}
          <div className="stat">
            <div className="muted" style={{ fontSize: 12 }}>已知时长</div>
            <div className="n">{hours.toLocaleString()} 小时</div>
          </div>
        </div>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          时长只有自托管的那批取回来了，所以「已知时长」是下限，不是全库的总长度。
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>需要处理的</h3>
        <div className="stat-grid">
          {stats.gaps.map((gap) => (
            <a className="stat" key={gap.key} href={gap.href} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="muted" style={{ fontSize: 12 }}>{gap.label}</div>
              <div className="n" style={{ color: gap.count > 0 ? "#b42318" : undefined }}>
                {gap.count.toLocaleString()}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>按来源平台</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>平台</th>
                <th style={{ textAlign: "right" }}>数量</th>
                <th>大陆能否直接观看</th>
              </tr>
            </thead>
            <tbody>
              {stats.byHost.map((row) => (
                <tr key={row.key}>
                  <td>
                    <a href={`/admin/videos?host=${row.key}`}>{row.label}</a>
                  </td>
                  <td style={{ textAlign: "right" }}>{row.count.toLocaleString()}</td>
                  <td className="muted">{row.key === "none" ? "—" : row.reachable ? "可以" : "需翻墙"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          <b>{unreachable.toLocaleString()} 个视频大陆读者看不到。</b>
          给它们补上干净世界的备用地址是编辑部的活，不是技术问题。
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>每个分类有多少</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>分类</th>
                <th style={{ textAlign: "right" }}>视频数</th>
                <th style={{ width: 220 }}>占比</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCategory.map((row) => (
                <tr key={row.slug}>
                  <td>
                    <a href={`/admin/videos?category=${row.slug}`}>{row.name}</a>
                  </td>
                  <td style={{ textAlign: "right" }}>{row.count.toLocaleString()}</td>
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
        <h3 style={{ marginTop: 0 }}>按年份</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>年份</th>
                <th style={{ textAlign: "right" }}>数量</th>
                <th style={{ width: 220 }}>分布</th>
              </tr>
            </thead>
            <tbody>
              {stats.byYear.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td style={{ textAlign: "right" }}>{row.count.toLocaleString()}</td>
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
