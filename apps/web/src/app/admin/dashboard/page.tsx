import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { RevalidateButton } from "@/components/admin/RevalidateButton";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import {
  SYNC_INTERVAL_HOURS,
  getDashboardStats,
  getRecentArticles,
  getSyncStatus
} from "@/lib/admin/dashboard";

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
              每 {SYNC_INTERVAL_HOURS} 小时自动同步一次（UTC 时间每 {SYNC_INTERVAL_HOURS} 小时的 17 分）。
              由 Vercel Cron 定时触发 <code>/api/cron/santui</code>，通过 Browserless
              的云端浏览器抓取 —— santui.tuidang.org 有 Cloudflare 验证，普通请求会被挡，
              必须用真实浏览器。平时不需要做任何事，它会一直自己跑。
            </p>
            <p className="dash-note">
              上次同步：{sync.fetchedAt ? new Date(sync.fetchedAt).toLocaleString("zh-CN") : "—"}
              {sync.sourceUpdatedAt ? `　来源站更新于：${sync.sourceUpdatedAt}` : ""}
              {sync.newest ? `　最新一条声明：${sync.newest}` : ""}
            </p>
            {sync.state !== "fresh" ? (
              <p className="dash-alert">
                <b>同步可能已经停了。</b>首页的退党数字和下面的声明会一直停在上次抓到的内容，
                不会报错。请按顺序检查：
                <br />1. Vercel → 项目 → Settings → Cron Jobs，确认 <code>/api/cron/santui</code>
                还在、并且是 Enabled；点「Run」手动跑一次，看 View Logs 里是不是 200。
                <br />2. browserless.io → 账号首页，看本月 Units 是不是用完了
                （免费额度 1,000，每次同步约 1 个 Unit）。
                <br />3. Vercel 环境变量 <code>BROWSER_WS_ENDPOINT</code>、
                <code>BROWSER_WS_MODE</code>、<code>CRON_SECRET</code> 是否还在。
                <br />4. 都正常但还是不行：GitHub Actions 里的「Sync santui registry」
                仍保留着，可手动运行一次作为应急。
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
