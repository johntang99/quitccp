import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { MaterialCategoryDeleteButton } from "@/components/admin/MaterialCategoryDeleteButton";
import { MaterialTabs } from "@/components/admin/MaterialTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listMaterialCategories } from "@/lib/admin/material-repository";

interface PageProps {
  searchParams: Promise<{ error?: string; msg?: string }>;
}

/**
 * Rows are `<form>` elements in a CSS grid rather than a `<table>`: each row
 * saves on its own, and a form cannot legally be a child of `<tr>` -- written
 * that way it parses into broken HTML and throws a hydration error.
 */
const ROW = "72px 150px 180px 1fr 72px auto";

export default async function MaterialCategoriesPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;
  const { ready, rows } = await listMaterialCategories();

  return (
    <AdminShell user={user}>
      <MaterialTabs active="categories" />
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.mcat.title")}</h2>
        <p>
          {t("admin.mcat.intro1")}
        </p>
        <p style={{ margin: "6px 0 0", color: "#8a6d1f" }}>
          {t("admin.mcat.intro2")}
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
        {!ready ? (
          <p style={{ margin: "8px 0 0", color: "#8a6d1f", background: "#fffbe9", padding: "8px 10px" }}>
            {t("admin.mcat.noTable")}
            <code> supabase/content/migrations/017_materials.sql</code>。
          </p>
        ) : null}
      </section>

      {ready ? (
        <>
          <section className="admin-card" style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: ROW,
                gap: 10,
                fontSize: 12,
                color: "#777",
                letterSpacing: ".04em"
              }}
            >
              <span>{t("admin.mcat.col.order")}</span>
              <span>Slug</span>
              <span>{t("admin.mcat.col.name")}</span>
              <span>{t("admin.mcat.col.summary")}</span>
              <span>{t("admin.mcat.col.published")}</span>
              <span />
            </div>

            {rows.map((row) => (
              /* One form per row, saving on its own. 删除 lives in its own
                 client component beside 保存 so that both stay inside the
                 single trailing grid cell. */
              <form
                key={row.id}
                method="post"
                action="/api/admin/content/materials/category"
                style={{ display: "grid", gridTemplateColumns: ROW, gap: 10, alignItems: "center" }}
              >
                <input type="hidden" name="id" value={row.id} />
                <input className="admin-input" name="sortOrder" defaultValue={row.sortOrder} />
                <input className="admin-input" name="slug" defaultValue={row.slug} required />
                <input className="admin-input" name="name" defaultValue={row.name} required />
                <input className="admin-input" name="summary" defaultValue={row.summary} />
                <span style={{ color: "#555" }}>{row.count}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="admin-btn" type="submit">
                    {t("admin.mcat.save")}
                  </button>
                  {/* Confirms first, and posts on its own so the row's unsaved
                      edits are not carried along with a delete. */}
                  <MaterialCategoryDeleteButton id={row.id} name={row.name} count={row.count} />
                </span>
              </form>
            ))}
            {rows.length === 0 ? <p style={{ color: "#888", margin: 0 }}>{t("admin.mcat.empty")}</p> : null}
          </section>

          <section className="admin-card" style={{ marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>{t("admin.mcat.addTitle")}</h3>
            <form
              method="post"
              action="/api/admin/content/materials/category"
              style={{ display: "grid", gridTemplateColumns: "72px 150px 180px 1fr auto", gap: 10, alignItems: "end" }}
            >
              <label>
                {t("admin.mcat.col.order")}
                {/* 10, 20, 30… so a new one can be slipped between two existing
                    rows without renumbering the rest. */}
                <input className="admin-input" name="sortOrder" defaultValue={(rows.length + 1) * 10} />
              </label>
              <label>
                Slug
                <input className="admin-input" name="slug" required placeholder="kind-words" />
              </label>
              <label>
                {t("admin.mcat.col.name")}
                <input className="admin-input" name="name" required placeholder={t("admin.mcat.namePlaceholder")} />
              </label>
              <label>
                {t("admin.mcat.summaryLabel")}
                <input className="admin-input" name="summary" placeholder={t("admin.mcat.summaryPlaceholder")} />
              </label>
              <button className="admin-btn admin-btn-primary" type="submit">
                {t("admin.mcat.add")}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
