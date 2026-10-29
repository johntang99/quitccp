import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SITE_LOCALE } from "@/lib/site-config";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { articleDimension, articleSeries, statsRange } from "@/lib/admin/site-stats";
import { DailyColumns, RangeSwitch, RankTable, countryName, parseDays, sourceTypeName } from "@/components/admin/StatsBits";

/** 单篇文章的阅读数据：每日阅读、来源类别、国家。 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminArticleStatsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdminSessionUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const days = parseDays((await searchParams).days);
  const { from, to } = statsRange(days);

  const { data: article } = await createSupabaseAdminClient()
    .from("cms_articles")
    .select("id, title, slug, short_code, published_at")
    .eq("id", id)
    .eq("locale", SITE_LOCALE)
    .maybeSingle();
  if (!article) notFound();

  const [series, sources, countries] = await Promise.all([
    articleSeries(id, from, to),
    articleDimension(id, "source_type", from, to),
    articleDimension(id, "country", from, to)
  ]);
  const views = series.reduce((s, r) => s + r.views, 0);

  /* Fill the days nobody read it, so the columns line up with the calendar. */
  const byDay = new Map(series.map((r) => [r.day, r]));
  const filled = [];
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += 86_400_000) {
    const day = new Date(ms).toISOString().slice(0, 10);
    filled.push(byDay.get(day) ?? { day, views: 0, visitors: 0 });
  }

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <p className="dash-note" style={{ marginTop: 0 }}>
          <Link href={`/admin/stats?days=${days}` as Route}>← {t("admin.traffic.title")}</Link>
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{String(article.title)}</h2>
          <RangeSwitch days={days} base={`/admin/stats/article/${id}`} />
        </div>
        <p className="dash-note">
          <a href={`/news/${encodeURIComponent(String(article.slug))}`} target="_blank" rel="noreferrer">{t("admin.traffic.viewArticle")}</a>
          {" · "}
          <Link href={`/admin/articles/${id}` as Route}>{t("admin.traffic.editArticle")}</Link>
        </p>
        <div className="dash-stats">
          <div className="dash-stat"><b>{formatNumber(views)}</b><span>{t("admin.traffic.views", { n: days })}</span></div>
          <div className="dash-stat"><b>{formatNumber(series.reduce((s, r) => s + r.visitors, 0))}</b><span>{t("admin.traffic.visitorDays")}</span></div>
        </div>
        <h3>{t("admin.traffic.daily")}</h3>
        <DailyColumns rows={filled} />
      </section>

      <section className="admin-card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>{t("admin.traffic.sources")}</h3>
            <RankTable
              head={t("admin.traffic.col.sourceType")}
              showVisitors={false}
              rows={sources.map((r) => ({ key: r.value, label: sourceTypeName(r.value), views: r.views }))}
            />
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>{t("admin.traffic.countries")}</h3>
            <RankTable
              head={t("admin.traffic.col.country")}
              showVisitors={false}
              rows={countries.slice(0, 20).map((r) => ({ key: r.value, label: countryName(r.value), views: r.views }))}
            />
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
