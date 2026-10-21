import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { CategoryRowActions } from "@/components/admin/CategoryRowActions";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories } from "@/lib/admin/video-repository";

interface PageProps {
  searchParams: Promise<{ error?: string; msg?: string }>;
}

export default async function VideoCategoriesPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;
  const rows = await listVideoCategories();

  return (
    <AdminShell user={user}>
      <VideoTabs active="categories" />
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.vcat.title")}</h2>
        <p>
          {t("admin.vcat.intro1")}
          <br />
          {t("admin.vcat.intro2")}
          <br />
          {tRich("admin.vcat.intro3", { yours: <b>{t("admin.vcat.intro3Yours")}</b> })}
        </p>
        {params.error ? (
          <p style={{ margin: "8px 0 0", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>
            {decodeURIComponent(params.error)}
          </p>
        ) : null}
        {params.msg ? (
          <p style={{ margin: "8px 0 0", color: "#1f7a4d", background: "#f0fbf4", padding: "8px 10px" }}>
            {decodeURIComponent(params.msg)}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p style={{ margin: "8px 0 0", color: "#8a6d1f", background: "#fffbe9", padding: "8px 10px" }}>
            {t("admin.vcat.schemaMissing")}
            <code> supabase/content/migrations/012_video_categories.sql</code>。
          </p>
        ) : null}
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>{t("admin.cat.col.order")}</th>
              <th style={{ width: 140 }}>{t("admin.cat.col.name")}</th>
              <th style={{ width: 150 }}>slug</th>
              <th style={{ width: 70 }}>{t("admin.vcat.col.count")}</th>
              <th>{t("admin.cat.col.blurb")}</th>
              <th style={{ width: 110 }}>{t("admin.cat.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>{t("admin.cat.empty")}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} data-snapshot="data">
                  <td>{row.sortOrder}</td>
                  <td>{row.name}</td>
                  <td style={{ fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all" }}>{row.slug}</td>
                  <td>{row.videoCount}</td>
                  <td>
                    {/* The inputs sit in their own cells but belong to one form,
                        tied together by `form={formId}` -- a <form> cannot span
                        table cells, and putting every field in the last column
                        would hide the description behind a scrollbar. */}
                    <textarea
                      className="admin-input"
                      form={`vc-${row.id}`}
                      name="description"
                      defaultValue={row.description}
                      rows={2}
                      placeholder={t("admin.vcat.blurbPlaceholder")}
                      style={{ width: "100%", minWidth: 260, resize: "vertical" }}
                      aria-label={t("admin.cat.aria.blurb", { name: row.name })}
                    />
                  </td>
                  <td>
                    <form
                      id={`vc-${row.id}`}
                      method="post"
                      action="/api/admin/content/video-categories"
                      className="admin-toolbar"
                      style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        className="admin-input"
                        name="sortOrder"
                        type="number"
                        step={1}
                        defaultValue={row.sortOrder}
                        aria-label={t("admin.cat.aria.order", { name: row.name })}
                      />
                      <input className="admin-input" name="name" defaultValue={row.name} aria-label={t("admin.cat.aria.name", { name: row.name })} required />
                    </form>
                    {/* Outside the form on purpose: the delete half posts its
                        own fields, and a form inside a form is illegal HTML.
                        The save button reaches back in via `form={…}`. */}
                    <div style={{ marginTop: 6 }}>
                      <CategoryRowActions
                        formId={`vc-${row.id}`}
                        id={row.id}
                        name={row.name}
                        count={row.videoCount}
                        kind="video"
                        deleteAction="/api/admin/content/video-categories/delete"
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.cat.addTitle")}</h3>
        <form method="post" action="/api/admin/content/video-categories" className="admin-toolbar">
          <input className="admin-input" name="name" placeholder={t("admin.cat.namePlaceholder")} required />
          <input className="admin-input" name="slug" placeholder={t("admin.cat.slugPlaceholder")} />
          <input
            className="admin-input"
            name="description"
            placeholder={t("admin.cat.blurbNewPlaceholder")}
            style={{ minWidth: 260 }}
          />
          <input
            className="admin-input"
            name="sortOrder"
            type="number"
            step={1}
            defaultValue={0}
            placeholder={t("admin.cat.orderPlaceholder")}
            style={{ width: 90 }}
            aria-label={t("admin.cat.orderPlaceholder")}
          />
          <button className="admin-btn admin-btn-primary" type="submit">
            {t("admin.cat.add")}
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
