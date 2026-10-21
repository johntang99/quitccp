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
  PROBE_TERM,
  getDashboardStats,
  getRecentArticles,
  getSearchStatus,
  getSyncStatus
} from "@/lib/admin/dashboard";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ago } from "@/lib/admin/relative-time";
import { FirewallNotesPanel } from "@/components/admin/FirewallNotesPanel";
import { SantuiSyncPanel } from "@/components/admin/SantuiSyncPanel";
import { SANTUI_LOCALES } from "@/lib/cron-locale";
import { SITE_LOCALE } from "@/lib/site-config";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";

const SEARCH_LABEL: Record<string, { text: string; tone: string }> = {
  normal: { text: t("admin.dash.search.state.normal"), tone: "#157347" },
  nomeili: { text: t("admin.dash.search.state.nomeili"), tone: "#157347" },
  drifted: { text: t("admin.dash.search.state.drifted"), tone: "#B54708" },
  fallback: { text: t("admin.dash.search.state.fallback"), tone: "#B54708" },
  down: { text: t("admin.dash.search.state.down"), tone: "#B42318" }
};

const BACKEND_LABEL: Record<string, string> = {
  meilisearch: t("admin.dash.search.backend.meilisearch"),
  substring: t("admin.dash.search.backend.substring"),
  pg_trgm: t("admin.dash.search.backend.pg_trgm"),
  fallback_ilike: t("admin.dash.search.backend.fallback_ilike")
};

/**
 * How a check's state is shown. `unknown` is grey rather than red on purpose:
 * most of the probes that cannot measure are blocked by our own attack
 * challenge, which is the firewall working, not a fault.
 */
const CHECK_LABEL: Record<CheckState, { text: string; tone: string }> = {
  ok: { text: t("admin.check.ok"), tone: "#157347" },
  warn: { text: t("admin.check.warn"), tone: "#B54708" },
  bad: { text: t("admin.check.bad"), tone: "#B42318" },
  unknown: { text: t("admin.check.unknown"), tone: "#667085" }
};

/** The worst state in the set, as the panel's own badge. */
const WORST_LABEL: Record<CheckState, { text: string; tone: string }> = {
  ok: { text: t("admin.check.worst.ok"), tone: "#157347" },
  warn: { text: t("admin.check.worst.warn"), tone: "#B54708" },
  bad: { text: t("admin.check.worst.bad"), tone: "#B42318" },
  unknown: { text: t("admin.check.worst.unknown"), tone: "#667085" }
};

/** How each recorded transition reads in the 最近的报警 list. */
const EVENT_LABEL: Record<string, { text: string; tone: string }> = {
  detected: { text: t("admin.event.detected"), tone: "#B54708" },
  new: { text: t("admin.event.new"), tone: "#B42318" },
  reminder: { text: t("admin.event.reminder"), tone: "#B42318" },
  recovered: { text: t("admin.event.recovered"), tone: "#157347" }
};

/** Older than this and the self-check itself has probably stopped running. */
const SELFCHECK_STALE_HOURS = 3;

const num = (n: number) => (n < 0 ? t("admin.dash.unknown") : formatNumber(n));

export default async function AdminDashboardPage() {
  const user = await requireAdminSessionUser();
  /* Only for the roles that could act on it. An editor seeing
     「文章页走 CDN 缓存：MISS」 cannot do anything about it and would reasonably
     read it as "the site is broken, do not publish" -- the same reasoning that
     keeps the revalidate button off their dashboard. */
  const showDefense = can(user, "publish.revalidate");
  const [stats, sync, search, misses, recent, defense, defenseEvents] = await Promise.all([
    getDashboardStats(),
    /* 别的站不跑这个任务，连查都不用查。 */
    (SANTUI_LOCALES as readonly string[]).includes(SITE_LOCALE) ? getSyncStatus() : Promise.resolve(null),
    getSearchStatus(),
    listSearchMisses(12),
    getRecentArticles(6),
    showDefense ? readDefenseReport() : Promise.resolve(null),
    showDefense ? readDefenseEvents() : Promise.resolve([])
  ]);
  const searchBadge = SEARCH_LABEL[search.state];

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div className="dash-head">
          <h2 style={{ margin: 0 }}>{t("admin.dash.title")}</h2>
          {/* Hidden rather than shown-and-refused: an editor seeing a button
              they cannot use would press it when their change seems missing,
              which is the moment this tool is least appropriate. */}
          {can(user, "publish.revalidate") ? <RevalidateButton /> : null}
        </div>
        <p className="dash-note">{t("admin.dash.saveNote")}</p>
        <div className="dash-stats">
          {[
            { label: t("admin.dash.stat.articles"), value: stats.articles, href: "/admin/articles" },
            { label: t("admin.dash.stat.videos"), value: stats.videos, href: "/admin/videos" },
            { label: t("admin.dash.stat.materials"), value: stats.materials, href: "/admin/materials" },
            { label: t("admin.dash.stat.pages"), value: stats.pages, href: "/admin/content" },
            { label: t("admin.dash.stat.declarations"), value: stats.declarations, href: "/admin/declarations" },
            { label: t("admin.dash.stat.audits"), value: stats.audits, href: "/admin/audit" }
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
              {t("admin.dash.declarationsPending", { n: num(stats.declarationsPending) })}
            </Link>
          </p>
        ) : null}
      </section>

      {showDefense ? (
        <section className="admin-card">
          <div className="dash-head">
            <h3 style={{ margin: 0 }}>{t("admin.dash.defense.title")}</h3>
            {defense ? (
              <span
                className="dash-badge"
                style={{ color: WORST_LABEL[defense.worst].tone, borderColor: WORST_LABEL[defense.worst].tone }}
              >
                {WORST_LABEL[defense.worst].text}
              </span>
            ) : null}
          </div>
          <p className="dash-note">{t("admin.dash.defense.note")}</p>
          {!defense ? (
            <p className="dash-alert">
              <b>{t("admin.dash.defense.never")}</b>
              {tRich("admin.dash.defense.neverBody", { path: <code>/api/cron/selfcheck</code> })}
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
                {t("admin.dash.defense.checkedAt")}
                {/* 时间是数据，不是文案 —— 不标出来，文案快照每跑一次自检就报
                    一条假差异。 */}
                <span data-snapshot="data">
                  {ago((Date.now() - new Date(defense.checkedAt).getTime()) / 3_600_000)}
                  　（{formatDateTime(defense.checkedAt)}）
                </span>
              </p>
              {(Date.now() - new Date(defense.checkedAt).getTime()) / 3_600_000 > SELFCHECK_STALE_HOURS ? (
                <p className="dash-alert">
                  <b>{t("admin.dash.defense.staleTitle")}</b>
                  {tRich("admin.dash.defense.staleBody", {
                    ago: ago((Date.now() - new Date(defense.checkedAt).getTime()) / 3_600_000),
                    path: <code>/api/cron/selfcheck</code>
                  })}
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
              <h4 style={{ margin: "18px 0 6px", fontSize: 14 }}>{t("admin.dash.defense.recentAlerts")}</h4>
              <p className="dash-note" style={{ marginTop: 0 }}>
                {tRich("admin.dash.defense.alertsNote", {
                  what: <b>{t("admin.dash.defense.alertsNoteWhat")}</b>
                })}
              </p>
              <table className="admin-table" style={{ maxWidth: 620, fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr><th style={{ width: 150 }}>{t("admin.dash.defense.col.time")}</th><th style={{ width: 90 }}>{t("admin.dash.defense.col.what")}</th><th>{t("admin.dash.defense.col.which")}</th></tr>
                </thead>
                <tbody data-snapshot="data">
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

      {/* 这两块属于「哪个站」，不属于「哪种语言」：防火墙规则每个 Vercel
          项目各一份，抓登记册的 cron 只在中文站跑。放在各自的组件里，
          组件的文档说明了为什么别的站不该看到它们。 */}
      {showDefense && SITE_LOCALE === "zh" ? <FirewallNotesPanel /> : null}

      {sync ? <SantuiSyncPanel sync={sync} /> : null}

      <section className="admin-card">
        <div className="dash-head">
          <h3 style={{ margin: 0 }}>{t("admin.dash.search.title")}</h3>
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
            <span>{t("admin.dash.search.who")}</span>
          </div>
          <div>
            <b>{search.probeResults > 0 ? `${search.probeMs} ms` : t("admin.dash.search.noResult")}</b>
            <span>{t("admin.dash.search.probe", { term: PROBE_TERM })}</span>
          </div>
          <div>
            <b>
              {search.meiliConfigured
                ? search.indexed === null
                  ? t("admin.dash.search.unreadable")
                  : formatNumber(search.indexed)
                : t("admin.dash.search.disabled")}
            </b>
            <span>{t("admin.dash.search.indexed")}</span>
          </div>
          <div>
            <b>{formatNumber(search.expected)}</b>
            <span>{t("admin.dash.search.expected")}</span>
          </div>
        </div>
        <p className="dash-note">
          {t("admin.dash.search.note")}
          {t(search.meiliConfigured ? "admin.dash.search.noteMeili" : "admin.dash.search.noteDirect")}
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
                <tbody data-snapshot="data">
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
          <h3 style={{ margin: 0 }}>{t("admin.dash.recentTitle")}</h3>
          <span className="dash-actions">
            <Link className="admin-btn admin-btn-sm" href="/admin/articles/new">{t("admin.dash.newArticle")}</Link>
            <Link className="admin-btn admin-btn-sm" href="/admin/videos/new">{t("admin.dash.newVideo")}</Link>
            <Link className="admin-btn admin-btn-sm" href="/admin/materials/new">{t("admin.dash.newMaterial")}</Link>
          </span>
        </div>
        {recent.length === 0 ? (
          <p className="dash-note">{t("admin.dash.noArticles")}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>{t("admin.dash.col.title")}</th><th>{t("admin.dash.col.category")}</th><th>{t("admin.dash.col.status")}</th><th>{t("admin.dash.col.updated")}</th></tr>
            </thead>
            <tbody data-snapshot="data">
              {recent.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></td>
                  <td>{a.category || "—"}</td>
                  <td>{a.status === "published" ? t("admin.status.published") : a.status === "draft" ? t("admin.status.draft") : a.status}</td>
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
