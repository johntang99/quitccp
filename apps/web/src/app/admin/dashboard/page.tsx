import Link from "next/link";
import type { Route } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { MISS_RETENTION_DAYS, listSearchMisses } from "@/lib/search-misses";
import { RevalidateButton } from "@/components/admin/RevalidateButton";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import {
  SYNC_INTERVAL_HOURS,
  getDashboardStats,
  getRecentArticles,
  getSearchStatus,
  getSyncStatus
} from "@/lib/admin/dashboard";

const SEARCH_LABEL: Record<string, { text: string; tone: string }> = {
  normal: { text: "正常", tone: "#157347" },
  nomeili: { text: "正常（数据库直查）", tone: "#157347" },
  drifted: { text: "索引与数据库不一致", tone: "#B54708" },
  fallback: { text: "已降级到备用后端", tone: "#B54708" },
  down: { text: "搜不到结果", tone: "#B42318" }
};

const BACKEND_LABEL: Record<string, string> = {
  meilisearch: "Meilisearch 索引",
  substring: "数据库直查（子串）",
  pg_trgm: "pg_trgm（已弃用）",
  fallback_ilike: "仅标题（最后兜底）"
};

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
  const [stats, sync, search, misses, recent] = await Promise.all([
    getDashboardStats(),
    getSyncStatus(),
    getSearchStatus(),
    listSearchMisses(12),
    getRecentArticles(6)
  ]);
  const badge = SYNC_LABEL[sync.state];
  const searchBadge = SEARCH_LABEL[search.state];

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
          <h3 style={{ margin: 0 }}>站内搜索</h3>
          <span
            className="dash-badge"
            style={{ color: searchBadge.tone, borderColor: searchBadge.tone }}
          >
            {searchBadge.text}
          </span>
        </div>
        <div className="dash-sync">
          <div>
            <b>{BACKEND_LABEL[search.effective] ?? search.effective}</b>
            <span>当前由谁回答</span>
          </div>
          <div>
            <b>{search.probeResults > 0 ? `${search.probeMs} ms` : "无结果"}</b>
            <span>试搜「三退」</span>
          </div>
          <div>
            <b>
              {search.meiliConfigured
                ? search.indexed === null
                  ? "读不到"
                  : search.indexed.toLocaleString("en-US")
                : "未启用"}
            </b>
            <span>索引条目</span>
          </div>
          <div>
            <b>{search.expected.toLocaleString("en-US")}</b>
            <span>数据库条目</span>
          </div>
        </div>
        <p className="dash-note">
          搜索覆盖文章、视频、资料三类内容，支持繁简互通、多词与同义词；
          三退声明与退党证明不在本站搜索范围内，由 santui.tuidang.org 与
          service.tuidang.org 提供查询。
          {search.meiliConfigured
            ? "　内容保存后立即进入索引，另有每小时增量与每周全量同步兜底。"
            : "　目前直接查询数据库，内容一发布即可搜到，无需同步。"}
        </p>
        {search.state === "down" ? (
          <p className="dash-alert">
            <b>搜索查不到任何结果。</b>试搜一个全站都有的词也返回空，说明搜索链路出了问题，
            而不是没有相关内容。请检查：
            <br />1. Supabase 是否正常（数据库不可达时搜索会整体失败）。
            <br />2. Vercel 环境变量 <code>SEARCH_PRIMARY_BACKEND</code> 是否被改成了无效值。
            <br />3. 打开 <code>/api/search?q=三退</code> 看返回的 backend 字段是哪一个。
          </p>
        ) : null}
        {search.state === "fallback" ? (
          <p className="dash-alert">
            <b>配置的是「{BACKEND_LABEL[search.configured] ?? search.configured}」，
            实际由「{BACKEND_LABEL[search.effective] ?? search.effective}」在回答。</b>
            说明首选后端连不上，搜索已自动降级——结果仍然可用，但质量和速度会下降。
            {search.configured === "meilisearch"
              ? "　请检查 Meilisearch 服务是否还在运行、MEILI_HOST 是否可达。"
              : ""}
          </p>
        ) : null}
        {misses.length > 0 ? (
          <>
            <h4 style={{ margin: "18px 0 6px", fontSize: 14 }}>读者搜了却没找到的词</h4>
            <p className="dash-note" style={{ marginTop: 0 }}>
              只记录「没有任何结果」的搜索，并且只保留词本身和次数——不记录是谁搜的、
              从哪里搜的、什么时候搜的，{MISS_RETENTION_DAYS} 天不再出现就自动删除。
              这里出现次数多的词，通常意味着站内缺这类内容，或者用词和读者的说法对不上
              （后者可以加进同义词表）。
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table perm-table" style={{ maxWidth: 560 }}>
                <thead>
                  <tr><th>搜索词</th><th style={{ width: 70 }}>次数</th><th style={{ width: 110 }}>最近一次</th></tr>
                </thead>
                <tbody>
                  {misses.map((m) => (
                    <tr key={m.query}>
                      <td>
                        <Link href={`/search?q=${encodeURIComponent(m.query)}` as Route}>{m.query}</Link>
                      </td>
                      <td style={{ textAlign: "center" }}>{m.hits}</td>
                      <td>{m.lastSeen.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        {search.state === "drifted" ? (
          <p className="dash-alert">
            <b>索引里有 {search.indexed ?? "?"} 条，数据库里有 {search.expected} 条，对不上。</b>
            索引过期时搜索不会报错，只会搜不到新内容——这正是之前出过的问题。
            请到 <Link href="/admin/settings">站点设置</Link> 点一次「重建搜索索引」，
            或等每周的全量同步。
          </p>
        ) : null}
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
