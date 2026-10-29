import Link from "next/link";
import type { Route } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import {
  dailySeries,
  dimension,
  liveToday,
  statsRange,
  topArticles,
  topPages
} from "@/lib/admin/site-stats";
import {
  DailyColumns,
  RangeSwitch,
  RankTable,
  countryName,
  deviceName,
  langName,
  parseDays,
  placeName,
  sourceTypeName
} from "@/components/admin/StatsBits";

/**
 * 访问统计：全站流量、热门文章、读者从哪里来。
 *
 * 读的是每日汇总（cms_stats_*，迁移 045），只有「今天」直接问 Analytics
 * Engine。方案见 docs/implementation/site-analytics-plan.md。
 *
 * 所有登录的人都能看 —— 2026-10-29 站长的决定：编辑需要知道哪些稿子有人读、
 * 读者从哪里来。这里没有任何能指向个人的数据，所以不必像访问日志那样只给管理员。
 */
export const dynamic = "force-dynamic";

const num = (n: number) => formatNumber(n);

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAdminSessionUser();
  const days = parseDays((await searchParams).days);
  const { from, to } = statsRange(days);

  const [series, live, articles, pages, sourceTypes, sourceHosts, utm, countries, cities, devices, langs] = await Promise.all([
    dailySeries(from, to),
    liveToday(),
    topArticles(from, to, 30),
    topPages(from, to, 20),
    dimension("source_type", from, to),
    dimension("source_host", from, to, 30),
    dimension("utm", from, to, 20),
    dimension("country", from, to, 30),
    dimension("city", from, to, 30),
    dimension("device", from, to),
    dimension("lang", from, to, 15)
  ]);

  const views = series.reduce((s, r) => s + r.views, 0);
  const visitors = series.reduce((s, r) => s + r.visitors, 0);
  const entrances = series.reduce((s, r) => s + r.entrances, 0);
  const fresh = series.reduce((s, r) => s + r.new_visitors, 0);
  const avgVisitors = series.length > 0 ? Math.round(visitors / series.length) : 0;

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{t("admin.traffic.title")}</h2>
          <RangeSwitch days={days} base="/admin/stats" />
        </div>
        <p className="dash-note">{t("admin.traffic.intro", { from, to })}</p>

        <div className="dash-stats">
          <div className="dash-stat"><b>{num(views)}</b><span>{t("admin.traffic.views", { n: days })}</span></div>
          <div className="dash-stat"><b>{num(avgVisitors)}</b><span>{t("admin.traffic.avgVisitors")}</span></div>
          <div className="dash-stat"><b>{num(entrances)}</b><span>{t("admin.traffic.entrances")}</span></div>
          <div className="dash-stat"><b>{visitors > 0 ? `${Math.round((fresh / visitors) * 100)}%` : "—"}</b><span>{t("admin.traffic.newShare")}</span></div>
          <div className="dash-stat">
            <b>{live ? num(live.views) : "—"}</b>
            <span>{live ? t("admin.traffic.today", { n: num(live.visitors) }) : t("admin.traffic.todayUnavailable")}</span>
          </div>
        </div>

        {series.length === 0 ? (
          <p className="dash-alert">
            <b>{t("admin.traffic.noData")}</b>
            {t("admin.traffic.noDataBody")}
          </p>
        ) : (
          <>
            <h3>{t("admin.traffic.daily")}</h3>
            <DailyColumns rows={series} />
          </>
        )}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.traffic.topArticles")}</h3>
        <RankTable
          head={t("admin.traffic.col.article")}
          total={views}
          rows={articles.map((a) => ({
            key: a.id,
            label: <Link href={`/admin/stats/article/${a.id}?days=${days}` as Route}>{a.title}</Link>,
            views: a.views,
            visitors: a.visitors
          }))}
        />
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.traffic.sources")}</h3>
        <p className="dash-note" style={{ marginTop: 0 }}>{t("admin.traffic.sourcesNote")}</p>
        <RankTable
          head={t("admin.traffic.col.sourceType")}
          total={entrances}
          rows={sourceTypes.map((r) => ({ key: r.value, label: sourceTypeName(r.value), views: r.views, visitors: r.visitors }))}
        />
        <h4>{t("admin.traffic.sourceHosts")}</h4>
        <RankTable
          head={t("admin.traffic.col.sourceHost")}
          total={entrances}
          rows={sourceHosts.map((r) => ({
            key: r.value,
            label: r.value === "(direct)" ? t("admin.traffic.source.direct") : r.value,
            views: r.views,
            visitors: r.visitors
          }))}
        />
        {utm.length > 0 ? (
          <>
            <h4>{t("admin.traffic.utm")}</h4>
            <RankTable head="utm_source" total={entrances} rows={utm.map((r) => ({ key: r.value, label: r.value, views: r.views, visitors: r.visitors }))} />
          </>
        ) : null}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.traffic.geo")}</h3>
        <p className="dash-note" style={{ marginTop: 0 }}>{t("admin.traffic.geoNote")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
          <div>
            <h4 style={{ marginTop: 0 }}>{t("admin.traffic.countries")}</h4>
            <RankTable
              head={t("admin.traffic.col.country")}
              total={views}
              rows={countries.map((r) => ({ key: r.value, label: countryName(r.value), views: r.views, visitors: r.visitors }))}
            />
          </div>
          <div>
            <h4 style={{ marginTop: 0 }}>{t("admin.traffic.cities")}</h4>
            <RankTable
              head={t("admin.traffic.col.city")}
              total={views}
              rows={cities.map((r) => ({ key: r.value, label: placeName(r.value), views: r.views, visitors: r.visitors }))}
            />
          </div>
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.traffic.audience")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
          <div>
            <h4 style={{ marginTop: 0 }}>{t("admin.traffic.devices")}</h4>
            <RankTable
              head={t("admin.traffic.col.device")}
              total={views}
              rows={devices.map((r) => ({ key: r.value, label: deviceName(r.value), views: r.views, visitors: r.visitors }))}
            />
          </div>
          <div>
            <h4 style={{ marginTop: 0 }}>{t("admin.traffic.langs")}</h4>
            <RankTable
              head={t("admin.traffic.col.lang")}
              total={views}
              rows={langs.map((r) => ({ key: r.value, label: langName(r.value), views: r.views, visitors: r.visitors }))}
            />
          </div>
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.traffic.topPages")}</h3>
        <RankTable
          head={t("admin.traffic.col.page")}
          total={views}
          rows={pages.map((p) => ({
            key: p.path,
            label: (
              <>
                <a href={p.path} target="_blank" rel="noreferrer"><code>{p.path}</code></a>{" "}
                <span className="dash-note">{t(`admin.traffic.kind.${p.kind}`)}</span>
              </>
            ),
            views: p.views,
            visitors: p.visitors
          }))}
        />
      </section>

      {live && live.top.length > 0 ? (
        <section className="admin-card">
          <h3 style={{ marginTop: 0 }}>{t("admin.traffic.todayTop")}</h3>
          <RankTable
            head={t("admin.traffic.col.page")}
            showVisitors={false}
            total={live.views}
            rows={live.top.map((p) => ({ key: p.path, label: <code>{p.path}</code>, views: p.views }))}
          />
        </section>
      ) : null}
    </AdminShell>
  );
}
