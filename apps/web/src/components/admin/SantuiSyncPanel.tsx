import Link from "next/link";
import { SYNC_INTERVAL_HOURS, type SyncStatus } from "@/lib/admin/dashboard";
import { ago } from "@/lib/admin/relative-time";
import { formatDateTime } from "@/lib/format";

/**
 * 登记册同步的健康状况。
 *
 * ## 为什么只在中文站显示
 *
 * 抓 santui.tuidang.org 的那个定时任务只在中文站跑（见 lib/cron-locale.ts：
 * 四个站读同一份 vercel.json，不拦住的话对外部源的请求量就是四倍）。那个
 * 数字是全球总数，每个站的首页都显示它，但只有一个站去抓，其余从数据库读。
 *
 * 所以这块面板属于**去抓的那个站**。英文站的运维看到它，看到的是别人项目的
 * cron，下面那几条「到 Vercel → Settings → Cron Jobs 点 Run」也指不到他们
 * 自己的地方 —— 和这个文件里已有的那条理由一样：看得见又动不了的信息，
 * 比不显示更糟。
 *
 * 显示条件跟着 SANTUI_LOCALES 走，不另写一个 'zh'，否则哪天那个任务挪到
 * 别的站上跑，这里会悄悄对不上。
 *
 * 文案保持中文，不进语言包 —— 它只给中文站的运维看。
 */

const SYNC_LABEL: Record<string, { text: string; tone: string }> = {
  fresh: { text: "正常运行", tone: "#157347" },
  late: { text: "有延迟", tone: "#B54708" },
  stale: { text: "疑似停止", tone: "#B42318" },
  never: { text: "从未运行", tone: "#B42318" }
};

export function SantuiSyncPanel({ sync }: { sync: SyncStatus }) {
  const badge = SYNC_LABEL[sync.state];
  return (
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
          {/* 整块都是实时数字：抓回来的总数、几分钟前同步的。标成数据，
              否则后台文案快照每同步一次就报一条假差异。 */}
          <div className="dash-sync" data-snapshot="data">
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
            上次同步：
            <span data-snapshot="data">
              {sync.fetchedAt ? formatDateTime(sync.fetchedAt) : "—"}
              {sync.sourceUpdatedAt ? `　来源站更新于：${sync.sourceUpdatedAt}` : ""}
              {sync.newest ? `　最新一条声明：${sync.newest}` : ""}
            </span>
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
  );
}
