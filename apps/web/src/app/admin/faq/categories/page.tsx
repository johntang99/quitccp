import Link from "next/link";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listFaqCategories } from "@/lib/admin/faq-repository";

/**
 * Categories are a short list edited in place.
 *
 * Rows are `<form>` elements in a CSS grid rather than a `<table>`: each row
 * saves on its own, and a form cannot legally be a child of `<tr>` -- doing it
 * that way parsed into broken HTML and threw a hydration error.
 */
const ROW = "90px 170px 190px 1fr 70px auto";

export default async function FaqCategoriesPage() {
  const user = await requireAdminSessionUser();
  const { ready, rows } = await listFaqCategories();

  return (
    <AdminShell user={user}>
      <h2 style={{ margin: "0 0 12px" }}>{t("admin.fcat.title")}</h2>
      {!ready ? (
        <section className="admin-card">
          <p>
            {tRich("admin.fcat.noTable", { file: <code>supabase/content/migrations/023_faq.sql</code> })}
          </p>
        </section>
      ) : (
        <>
          <section className="admin-card">
            <div className="admin-toolbar">
              <Link className="admin-btn" href="/admin/faq">
                {t("admin.fcat.back")}
              </Link>
              <span style={{ color: "#666" }}>{t("admin.fcat.total", { n: rows.length })}</span>
            </div>
          </section>

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
              <span>{t("admin.fcat.col.slug")}</span>
              <span>{t("admin.mcat.col.name")}</span>
              <span>{t("admin.mcat.col.summary")}</span>
              <span>{t("admin.fcat.col.count")}</span>
              <span />
            </div>

            {rows.map((row) => (
              /* One form per row. The delete button points elsewhere with
                 `formAction` rather than opening a second form, which would
                 become a seventh grid item and wrap onto its own line. */
              <form
                key={row.id}
                method="post"
                action="/api/admin/content/faq/category"
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
                  <button
                    className="admin-btn"
                    type="submit"
                    formAction="/api/admin/content/faq/category/delete"
                    formNoValidate
                    title={t("admin.fcat.deleteTitle")}
                  >
                    {t("admin.list.delete")}
                  </button>
                </span>
              </form>
            ))}
            {rows.length === 0 ? <p style={{ color: "#888", margin: 0 }}>{t("admin.mcat.empty")}</p> : null}
          </section>

          <section className="admin-card" style={{ marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>{t("admin.mcat.addTitle")}</h3>
            <form
              method="post"
              action="/api/admin/content/faq/category"
              style={{ display: "grid", gridTemplateColumns: "90px 170px 190px 1fr auto", gap: 10, alignItems: "end" }}
            >
              <label>
                {t("admin.mcat.col.order")}
                <input className="admin-input" name="sortOrder" defaultValue={rows.length} />
              </label>
              <label>
                {t("admin.fcat.col.slug")}
                <input className="admin-input" name="slug" required placeholder="aqys" />
              </label>
              <label>
                {t("admin.mcat.col.name")}
                <input className="admin-input" name="name" required placeholder={t("admin.fcat.namePlaceholder")} />
              </label>
              <label>
                {t("admin.mcat.summaryLabel")}
                <input className="admin-input" name="summary" />
              </label>
              <button className="admin-btn admin-btn-primary" type="submit">
                {t("admin.mcat.add")}
              </button>
            </form>
          </section>
        </>
      )}
    </AdminShell>
  );
}
