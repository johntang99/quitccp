import Link from "next/link";
import type { Route } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { MISS_RETENTION_DAYS, listSearchMisses } from "@/lib/search-misses";
import { RevalidateButton } from "@/components/admin/RevalidateButton";
import { SelfCheckButton } from "@/components/admin/SelfCheckButton";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { readDefenseEvents, readDefenseReport, type CheckState } from "@/lib/admin/defense-status";
import { can } from "@/lib/admin/permissions";
import {
  SYNC_INTERVAL_HOURS,
  getDashboardStats,
  getRecentArticles,
  getSearchStatus,
  getSyncStatus
} from "@/lib/admin/dashboard";
import { formatDateTime, formatNumber } from "@/lib/format";

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

/**
 * How a check's state is shown. `unknown` is grey rather than red on purpose:
 * most of the probes that cannot measure are blocked by our own attack
 * challenge, which is the firewall working, not a fault.
 */
const CHECK_LABEL: Record<CheckState, { text: string; tone: string }> = {
  ok: { text: "正常", tone: "#157347" },
  warn: { text: "注意", tone: "#B54708" },
  bad: { text: "出问题", tone: "#B42318" },
  unknown: { text: "测不到", tone: "#667085" }
};

/** The worst state in the set, as the panel's own badge. */
const WORST_LABEL: Record<CheckState, { text: string; tone: string }> = {
  ok: { text: "全部正常", tone: "#157347" },
  warn: { text: "有一项需要注意", tone: "#B54708" },
  bad: { text: "有项目出问题", tone: "#B42318" },
  unknown: { text: "部分测不到", tone: "#667085" }
};

/** How each recorded transition reads in the 最近的报警 list. */
const EVENT_LABEL: Record<string, { text: string; tone: string }> = {
  detected: { text: "发现", tone: "#B54708" },
  new: { text: "已报警", tone: "#B42318" },
  reminder: { text: "仍未恢复", tone: "#B42318" },
  recovered: { text: "已恢复", tone: "#157347" }
};

/** Older than this and the self-check itself has probably stopped running. */
const SELFCHECK_STALE_HOURS = 3;

function ago(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟前`;
  if (hours < 48) return `${hours.toFixed(1)} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

const num = (n: number) => (n < 0 ? "未知" : formatNumber(n));

export default async function AdminDashboardPage() {
  const user = await requireAdminSessionUser();
  /* Only for the roles that could act on it. An editor seeing
     「文章页走 CDN 缓存：MISS」 cannot do anything about it and would reasonably
     read it as "the site is broken, do not publish" -- the same reasoning that
     keeps the revalidate button off their dashboard. */
  const showDefense = can(user, "publish.revalidate");
  const [stats, sync, search, misses, recent, defense, defenseEvents] = await Promise.all([
    getDashboardStats(),
    getSyncStatus(),
    getSearchStatus(),
    listSearchMisses(12),
    getRecentArticles(6),
    showDefense ? readDefenseReport() : Promise.resolve(null),
    showDefense ? readDefenseEvents() : Promise.resolve([])
  ]);
  const badge = SYNC_LABEL[sync.state];
  const searchBadge = SEARCH_LABEL[search.state];

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div className="dash-head">
          <h2 style={{ margin: 0 }}>平台概览</h2>
          {/* Hidden rather than shown-and-refused: an editor seeing a button
              they cannot use would press it when their change seems missing,
              which is the moment this tool is least appropriate. */}
          {can(user, "publish.revalidate") ? <RevalidateButton /> : null}
        </div>
        <p className="dash-note">
          保存文章、视频、页面内容、资料、分类或问答后，相关公开页面会立刻更新，不需要做任何事。
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

      {showDefense ? (
        <section className="admin-card">
          <div className="dash-head">
            <h3 style={{ margin: 0 }}>站点防护</h3>
            {defense ? (
              <span
                className="dash-badge"
                style={{ color: WORST_LABEL[defense.worst].tone, borderColor: WORST_LABEL[defense.worst].tone }}
              >
                {WORST_LABEL[defense.worst].text}
              </span>
            ) : null}
          </div>
          <p className="dash-note">
            10 月 13 日那场攻击之后加的几道防护，这里看它们现在还在不在。每小时自动检查一次，
            任何一项变成「出问题」会发一封邮件；同一个问题不会重复发，坏着的话每天提醒一次，
            恢复了再发一封。「测不到」多半是被我们自己的防火墙挑战页挡住了 —— 那是防火墙在干活，不是故障。
          </p>
          {!defense ? (
            <p className="dash-alert">
              <b>还没有检查过。</b>每小时的自动检查还没跑第一次，或者 Vercel 的 Cron
              还没认到 <code>/api/cron/selfcheck</code>。可以先点下面的「立即检查」手动跑一次。
            </p>
          ) : (
            <>
              <div className="dash-sync">
                {defense.checks.map((c) => (
                  <div key={c.key}>
                    <b style={{ color: CHECK_LABEL[c.state].tone }}>{c.value}</b>
                    <span>
                      {c.label}
                      {c.state === "ok" ? "" : `　${CHECK_LABEL[c.state].text}`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="dash-note">
                检查于 {ago((Date.now() - new Date(defense.checkedAt).getTime()) / 3_600_000)}
                　（{formatDateTime(defense.checkedAt)}）
              </p>
              {(Date.now() - new Date(defense.checkedAt).getTime()) / 3_600_000 > SELFCHECK_STALE_HOURS ? (
                <p className="dash-alert">
                  <b>自检本身可能已经停了。</b>上面这些结论是 {ago((Date.now() - new Date(defense.checkedAt).getTime()) / 3_600_000)}的，
                  不代表现在的状态 —— 自检停掉之后这块面板不会报错，只会一直停在最后一次的结果，
                  报警邮件也不会再发。请到 Vercel → 项目 → Settings → Cron Jobs，
                  确认 <code>/api/cron/selfcheck</code> 还在并且是 Enabled。
                </p>
              ) : null}
              {/* Grouped by remedy rather than one block per check: the three
                  render-dependent probes share a single cause and a single
                  fix, and printing the same paragraph three times reads as a
                  bigger problem than it is. */}
              {Array.from(
                defense.checks
                  .filter((c) => c.state !== "ok" && c.remedy)
                  .reduce((groups, c) => {
                    const found = groups.get(c.remedy!) ?? [];
                    groups.set(c.remedy!, [...found, c]);
                    return groups;
                  }, new Map<string, typeof defense.checks>())
              ).map(([remedy, group]) => (
                <p className="dash-alert" key={group[0].key}>
                  <b>{group.map((c) => `${c.label}：${c.value}`).join("　｜　")}</b>
                  <br />
                  {remedy}
                </p>
              ))}
            </>
          )}
          {defenseEvents.length > 0 ? (
            <>
              <h4 style={{ margin: "18px 0 6px", fontSize: 14 }}>最近的报警</h4>
              <p className="dash-note" style={{ marginTop: 0 }}>
                只记状态变化，不记每次检查 —— 每小时跑一次的检查如果把自己也记下来，
                真正要紧的那两行会被两百行淹掉。「发现」那一行通常比邮件早一小时，
                因为连续两次坏才发信：它回答的是<b>什么时候开始的</b>，邮件回答的只是什么时候告诉你的。
              </p>
              <table className="admin-table" style={{ maxWidth: 620, fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr><th style={{ width: 150 }}>时间</th><th style={{ width: 90 }}>发生了什么</th><th>哪一项</th></tr>
                </thead>
                <tbody>
                  {defenseEvents.slice(0, 12).map((e, i) => {
                    const badge = EVENT_LABEL[e.kind] ?? { text: e.kind, tone: "#667085" };
                    return (
                      <tr key={`${e.at}-${e.kind}-${i}`}>
                        <td>{formatDateTime(e.at)}</td>
                        <td style={{ color: badge.tone }}>{badge.text}</td>
                        <td>{e.labels.join("、") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : null}
          <p style={{ margin: "14px 0 0" }}>
            <SelfCheckButton />
          </p>
        </section>
      ) : null}

      {showDefense ? (
        <section className="admin-card">
          <h3 style={{ marginTop: 0 }}>防火墙里的放行规则</h3>
          <p className="dash-note">
            这里记的是几条<b>绕过全部防火墙规则</b>的放行规则。它们在 <b>Vercel</b> 的防火墙里，
            不在 Cloudflare —— <code>tuidang.org</code> 在 Cloudflare 上只做 DNS，网站托管在 Vercel。
            （只有 <code>service</code>、<code>santui</code> 那几个子域是 Cloudflare 代理的。）
            找错地方会白费很多时间，这是 2026-10-15 真发生过的事。
          </p>
          <table className="admin-table" style={{ maxWidth: 760 }}>
            <thead>
              <tr><th style={{ width: 210 }}>规则</th><th style={{ width: 230 }}>认什么</th><th>给谁用</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Allow 免翻 reverse proxy v2</td>
                <td>出口 IP <b>并且</b> <code>td-auth</code> 请求头</td>
                <td>Tom 维护的免翻墙反代。墙内读者靠它访问本站</td>
              </tr>
              <tr>
                <td style={{ color: "#B54708" }}>Allow 免翻 reverse proxy（旧）</td>
                <td>只认 <code>td-auth</code> 请求头</td>
                <td><b>待删。</b>只为换密钥期间不断线而保留，Tom 确认新密钥生效后就撤掉</td>
              </tr>
              <tr>
                <td>Bypass for selfcheck probe</td>
                <td><code>x-quitccp-probe</code> 请求头</td>
                <td>上面「站点防护」里那三项需要真实渲染页面的检查</td>
              </tr>
            </tbody>
          </table>
          <p className="dash-note">
            <b>Vercel 的 Bypass 会终止后续全部规则</b> —— 不只是跳过机器人挑战，而是连按 ASN 的封禁、
            按 IP 的 300 次/分限速一起跳过。所以命中放行规则的请求，等于对全站免检。
            反代那条绕不开：一台代理替很多人取页面，一分钟 300 次一下就超，不给它免检墙内就打不开。
          </p>
          <p className="dash-note">
            v2 比旧的那条严得多：<b>两个条件是「并且」</b>，光知道请求头、不是从那个 IP 来的照样被挡。
            实测过 —— 拿着正确的新密钥从别处请求，返回 429。
          </p>
          <p className="dash-alert">
            <b>免翻墙打不开了，先看这里。</b>命令行 <code>npx vercel firewall rules list</code>
            　看那条 <code>Allow 免翻 reverse proxy v2</code> 还在不在、是不是还排在
            「Rate limit per IP」上面。排到下面去就会被 300 次/分那条挡住，表现和被删掉一样。
            <br />
            <b>还有一个新的失效方式：反代换了服务器、出口 IP 变了，这条规则就不再匹配。</b>
            表现是墙内打不开，而本站这边一切正常、没有任何报错 —— 对我们来说那只是又一个被挑战的请求。
            遇到这种情况先问 Tom 现在的出口 IP，再用 <code>rules edit</code> 改掉。
          </p>
          <p className="dash-note" style={{ marginBottom: 0 }}>
            为什么这里是一段说明而不是一项自动检查：探针没法可靠地验证它。
            Node 的 fetch 会复用连接，而「站点防护」的其他探针正带着放行头在同一个连接池上跑，
            所以一个不带头的请求也会骑在已经放行过的连接上，永远返回正常 —— 测不出规则是不是被删了。
            同样的原因，原来那项「防火墙挑战」探针也已经撤掉了。
          </p>
        </section>
      ) : null}

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
              上次同步：{sync.fetchedAt ? formatDateTime(sync.fetchedAt) : "—"}
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
            <br />3. 在本浏览器打开 <code>/api/search?q=三退</code> 看返回的 backend 字段是哪一个（需登录后台，退出后会返回 401）。
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
                  <td>{formatDateTime(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
