import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { RevalidateButton } from "@/components/admin/RevalidateButton";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getDashboardStats, getRecentArticles, getSyncStatus } from "@/lib/admin/dashboard";

const SYNC_LABEL: Record<string, { text: string; tone: string }> = {
  fresh: { text: "正常运行", tone: "#157347" },
  late: { text: "有延迟", tone: "#B54708" },
  stale: { text: "疑似停止", tone: "#B42318" },
  never: { text: "从未运行", tone: "#B42318" }
};

function ago(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟前`;
  if (hours < 48) return `${hours.toFixed(1)} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

const num = (n: number) => (n < 0 ? "未知" : n.toLocaleString("zh-CN"));

export default async function AdminDashboardPage() {
  const user = await requireAdminSessionUser();
  const [stats, sync, recent] = await Promise.all([
    getDashboardStats(),
    getSyncStatus(),
    getRecentArticles(6)
  ]);
  const badge = SYNC_LABEL[sync.state];

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div className="dash-head">
          <h2 style={{ margin: 0 }}>平台概览</h2>
          <RevalidateButton />
        </div>
        <p className="dash-note">
          编辑保存后，公开页面最多 5 分钟才会更新。改完想立刻看到效果，按「立即发布」。
        </p>
        <div className="dash-stats">
          {[
            { label: "文章", value: stats.articles, href: "/admin/articles" },
            { label: "视频", value: stats.videos, href: "/admin/videos" },
            { label: "资料", value: stats.materials, href: "/admin/materials" },
            { label: "页面", value: stats.pages, href: "/admin/content" },
            { label: "三退声明", value: stats.declarations, href: "/admin/declarations" },
            { label: "审计记录", value: stats.audits, href: "/admin/audit" }
          ].map((s) => (
            <Link key={s.label} className="dash-stat" href={s.href}>
              <b>{num(s.value)}</b>
              <span>{s.label}</span>
            </Link>
          ))}
        </div>
        {stats.declarationsPending > 0 ? (
          <p className="dash-pending">
            <Link href="/admin/declarations">
              有 {num(stats.declarationsPending)} 条三退声明待处理 →
            </Link>
          </p>
        ) : null}
      </section>

      <section className="admin-card">
        <div className="dash-head">
          <h3 style={{ margin: 0 }}>登记册同步（santui.tuidang.org）</h3>
          <span className="dash-badge" style={{ color: badge.tone, borderColor: badge.tone }}>
            {badge.text}
          </span>
        </div>
        {sync.state === "never" ? (
          <p className="dash-note">
            还没有任何快照。首页的退党数字正在用 CMS 里的备用值。
          </p>
        ) : (
          <>
            <div className="dash-sync">
              <div><b>{sync.totalDisplay || "—"}</b><span>首页显示</span></div>
              <div><b>{sync.total ? sync.total.toLocaleString("en-US") : "—"}</b><span>总计人数</span></div>
              <div><b>{sync.declarations}</b><span>轮播声明</span></div>
              <div><b>{ago(sync.ageHours)}</b><span>上次同步</span></div>
            </div>
            <p className="dash-note">
              上次同步：{sync.fetchedAt ? new Date(sync.fetchedAt).toLocaleString("zh-CN") : "—"}
              {sync.sourceUpdatedAt ? `　来源站更新于：${sync.sourceUpdatedAt}` : ""}
              {sync.newest ? `　最新一条声明：${sync.newest}` : ""}
            </p>
            {sync.state !== "fresh" ? (
              <p className="dash-note" style={{ color: "#B42318" }}>
                每小时应同步一次。超过 3 小时没有更新，多半是 GitHub Actions 的定时任务停了
                （仓库 60 天无提交会被自动停用），请到 Actions 页面手动运行一次
                「Sync santui registry」。
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="admin-card">
        <div className="dash-head">
          <h3 style={{ margin: 0 }}>最近修改的文章</h3>
          <span className="dash-actions">
            <Link className="admin-btn admin-btn-sm" href="/admin/articles/new">新建文章</Link>
            <Link className="admin-btn admin-btn-sm" href="/admin/videos/new">新建视频</Link>
            <Link className="admin-btn admin-btn-sm" href="/admin/materials/new">新建资料</Link>
          </span>
        </div>
        {recent.length === 0 ? (
          <p className="dash-note">暂无文章。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>标题</th><th>分类</th><th>状态</th><th>更新时间</th></tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></td>
                  <td>{a.category || "—"}</td>
                  <td>{a.status === "published" ? "已发布" : a.status === "draft" ? "草稿" : a.status}</td>
                  <td>{new Date(a.updatedAt).toLocaleString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
