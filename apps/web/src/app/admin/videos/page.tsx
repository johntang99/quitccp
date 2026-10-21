import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { VideoTable } from "@/components/admin/VideoTable";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories, searchVideos, type VideoSearchFilters } from "@/lib/admin/video-repository";
import { WarmPages } from "@/components/admin/WarmPages";
import { formatNumber } from "@/lib/format";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const GAPS = [
  { key: "no-source", label: t("admin.vid.gap.noSource") },
  { key: "no-cover", label: t("admin.vid.gap.noCover") },
  { key: "no-description", label: t("admin.vid.gap.noDescription") }
] as const;

const HOSTS = [
  { key: "youtube", label: "YouTube" },
  { key: "ganjing", label: t("admin.vid.host.ganjing") },
  { key: "tuidang", label: t("admin.vid.host.tuidang") },
  { key: "none", label: t("admin.vid.host.none") }
] as const;

/** 查找与修改 — the video half of the article screen of the same name. */
export default async function AdminVideosPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [result, categories] = await Promise.all([
    searchVideos({
      q: params.q,
      category: params.category,
      status: params.status,
      host: params.host,
      gap: params.gap as VideoSearchFilters["gap"],
      featured: params.featured === "1" ? true : undefined,
      editorArchive: params.editorArchive === "1" ? true : undefined,
      from: params.from,
      to: params.to,
      sort: (params.sort as VideoSearchFilters["sort"]) ?? "published",
      page: Number(params.page ?? "1") || 1,
      pageSize: Number(params.pageSize ?? "20") || 20
    }),
    listVideoCategories()
  ]);

  const hrefWith = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value && key !== "msg") next.set(key, value);
    }
    const query = next.toString();
    return `/admin/videos${query ? `?${query}` : ""}`;
  };

  return (
    <AdminShell user={user}>
      <WarmPages />
      <VideoTabs active="search" />

      {!result.ready ? (
        <section className="admin-card" style={{ background: "#fffbe9", borderColor: "#f2e3b3" }}>
          <strong>{t("admin.vid.schemaMissing")}</strong>{" "}
          {tRich("admin.vid.schemaMissingRun", {
            file: <code>supabase/content/migrations/012_video_categories.sql</code>
          })}
        </section>
      ) : null}

      {params.msg ? (
        <section className="admin-card" style={{ background: "#f0fbf4", borderColor: "#bfe6cd" }}>
          <strong>{params.msg}</strong>
        </section>
      ) : null}

      <section className="admin-card">
        <form method="get" className="admin-toolbar" style={{ marginBottom: 8 }}>
          <input
            className="admin-input"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={t("admin.vid.searchPlaceholder")}
            style={{ flex: 1, minWidth: 220 }}
          />
          <select className="admin-select" name="category" defaultValue={params.category ?? ""}>
            <option value="">{t("admin.list.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}（{c.videoCount}）
              </option>
            ))}
          </select>
          <select className="admin-select" name="host" defaultValue={params.host ?? ""}>
            <option value="">{t("admin.vid.allSources")}</option>
            {HOSTS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.label}
              </option>
            ))}
          </select>
          <select className="admin-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">{t("admin.list.allStatuses")}</option>
            <option value="published">{t("admin.status.published")}</option>
            <option value="draft">{t("admin.status.draft")}</option>
            <option value="archived">{t("admin.status.archived")}</option>
          </select>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {t("admin.list.publishedBetween")}
            <input className="admin-input" type="date" name="from" defaultValue={params.from ?? ""} />
            {t("admin.list.dateTo")}
            <input className="admin-input" type="date" name="to" defaultValue={params.to ?? ""} />
          </label>
          <select className="admin-select" name="sort" defaultValue={params.sort ?? "published"}>
            <option value="published">{t("admin.list.sort.published")}</option>
            <option value="updated">{t("admin.list.sort.updated")}</option>
            <option value="duration">{t("admin.vid.sort.duration")}</option>
            <option value="title">{t("admin.list.sort.title")}</option>
          </select>
          {params.gap ? <input type="hidden" name="gap" value={params.gap} /> : null}
          {params.featured ? <input type="hidden" name="featured" value={params.featured} /> : null}
          {params.editorArchive ? (
            <input type="hidden" name="editorArchive" value={params.editorArchive} />
          ) : null}
          <button className="admin-btn admin-btn-primary" type="submit">
            {t("admin.list.search")}
          </button>
        </form>

        <div className="admin-toolbar" style={{ marginBottom: 8 }}>
          <span className="chips">
            {/* The two editorial marks sit with the gap chips, same as articles:
                both answer "show me the subset I care about right now". */}
            <a
              className={`chip${params.featured ? " on" : ""}`}
              href={hrefWith({ featured: params.featured ? undefined : "1", page: undefined })}
            >
              {t("admin.list.featured")}
            </a>
            <a
              className={`chip${params.editorArchive ? " on" : ""}`}
              href={hrefWith({ editorArchive: params.editorArchive ? undefined : "1", page: undefined })}
            >
              {t("admin.list.editorArchive")}
            </a>
            {GAPS.map((gap) => (
              <a
                key={gap.key}
                className={`chip${params.gap === gap.key ? " on" : ""}`}
                href={hrefWith({ gap: params.gap === gap.key ? undefined : gap.key, page: undefined })}
              >
                {gap.label}
              </a>
            ))}
          </span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          {tRich("admin.vid.resultCount", {
            total: <b>{formatNumber(result.total)}</b>,
            page: formatNumber(result.page),
            pages: formatNumber(result.pageCount)
          })}
        </p>
      </section>

      <section className="admin-card">
        {/* The bulk form holds only its own controls. The row checkboxes join it
            by id, and the per-row delete form stays outside it -- a <form>
            inside a <form> is invalid HTML: React refuses to hydrate it and the
            browser drops the inner one, so delete did nothing at all. */}
        <form
          id="video-bulk-form"
          method="post"
          action="/api/admin/content/videos/bulk"
          className="admin-toolbar"
          style={{ marginBottom: 8 }}
        >
          <select className="admin-select" name="action" defaultValue="category">
            <option value="category">{t("admin.list.bulk.setCategory")}</option>
            <option value="published">{t("admin.list.bulk.publish")}</option>
            <option value="draft">{t("admin.list.bulk.draft")}</option>
            <option value="archived">{t("admin.list.bulk.archive")}</option>
          </select>
          <select className="admin-select" name="category" defaultValue="">
            <option value="">{t("admin.list.bulk.pickCategory")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="admin-btn" type="submit">
            {t("admin.vid.bulk.run")}
          </button>
          <span className="muted">{t("admin.vid.bulk.hint")}</span>
        </form>
        <VideoTable rows={result.rows} selectable bulkFormId="video-bulk-form" />

        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {result.page > 1 ? (
            <a className="admin-btn" href={hrefWith({ page: String(result.page - 1) })}>
              {t("admin.list.prevPage")}
            </a>
          ) : null}
          {result.page < result.pageCount ? (
            <a className="admin-btn" href={hrefWith({ page: String(result.page + 1) })}>
              {t("admin.list.nextPage")}
            </a>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
