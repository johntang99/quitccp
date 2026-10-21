import Link from "next/link";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { AdminShell } from "@/components/admin/AdminShell";
import { MaterialTabs } from "@/components/admin/MaterialTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listMaterialCategories, searchMaterials } from "@/lib/admin/material-repository";
import { actorLabel, listAdminDisplayNames } from "@/lib/admin/user-admin-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABEL: Record<string, string> = {
  published: t("admin.status.published"),
  draft: t("admin.status.draft"),
  archived: t("admin.status.archived")
};

/** 查找与修改 — the materials half of the screen articles and videos already have. */
export default async function AdminMaterialsPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [result, categories, actorNames] = await Promise.all([
    searchMaterials({
      q: params.q,
      category: params.category,
      status: params.status,
      page: Number(params.page ?? "1") || 1,
      pageSize: Number(params.pageSize ?? "20") || 20
    }),
    listMaterialCategories(),
    listAdminDisplayNames()
  ]);

  return (
    <AdminShell user={user}>
      <MaterialTabs active="search" />

      {!result.ready ? (
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("admin.mat.noTable")}</h2>
          <p>{tRich("admin.mat.noTableBody", { file: <code>supabase/content/migrations/017_materials.sql</code> })}</p>
        </section>
      ) : (
        <>
          <form className="admin-card" method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, flex: "1 1 240px" }}>
              {t("admin.mat.search")}
              <input className="admin-input" name="q" defaultValue={params.q ?? ""} placeholder={t("admin.mat.searchPlaceholder")} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              {t("admin.mat.category")}
              <select className="admin-input" name="category" defaultValue={params.category ?? ""}>
                <option value="">{t("admin.mat.all")}</option>
                {categories.rows.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}（{category.count}）
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              {t("admin.mat.status")}
              <select className="admin-input" name="status" defaultValue={params.status ?? ""}>
                <option value="">{t("admin.mat.all")}</option>
                <option value="published">{t("admin.status.published")}</option>
                <option value="draft">{t("admin.status.draft")}</option>
                <option value="archived">{t("admin.status.archived")}</option>
              </select>
            </label>
            <button className="admin-btn admin-btn--primary" type="submit">{t("admin.mat.query")}</button>
            <Link className="admin-btn" href="/admin/materials">{t("admin.mat.reset")}</Link>
          </form>

          <section className="admin-card">
            <p style={{ marginTop: 0, color: "#666", fontSize: 13 }}>{t("admin.mat.total", { n: result.total })}</p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>{t("admin.mat.col.preview")}</th>
                    <th>{t("admin.list.col.title")}</th>
                    <th>{t("admin.list.col.category")}</th>
                    <th>{t("admin.mat.col.files")}</th>
                    <th>{t("admin.list.col.status")}</th>
                    <th>{t("admin.vid.col.createdBy")}</th>
                    <th>{t("admin.vid.col.publishedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ color: "#777" }}>{t("admin.mat.empty")}</td>
                    </tr>
                  ) : (
                    result.rows.map((row) => (
                      <tr key={row.id} data-snapshot="data">
                        <td>
                          {row.coverImage ? (
                            <img src={row.coverImage} alt="" style={{ width: 60, height: 60, objectFit: "contain", background: "#fafafa" }} />
                          ) : (
                            <span style={{ color: "#bbb", fontSize: 12 }}>{t("admin.mat.noImage")}</span>
                          )}
                        </td>
                        <td>
                          <Link href={`/admin/materials/${row.id}`}>{row.title}</Link>
                          {/* Same ★ the article and video tables use for 重要. */}
                          {row.featured ? <span title={t("admin.list.col.featured")} style={{ color: "#c8102e", fontSize: 15, marginLeft: 6 }}>★</span> : null}
                          <div style={{ color: "#888", fontSize: 12 }}>{row.summary.slice(0, 48)}</div>
                        </td>
                        <td>{row.categories.join(t("admin.listSep")) || <span style={{ color: "#bbb" }}>{t("admin.list.uncategorised")}</span>}</td>
                        <td>{row.fileCount}</td>
                        <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                        {/* Who added it to the CMS. */}
                        <td style={{ color: "#888", whiteSpace: "nowrap" }} title={row.createdBy || undefined}>
                          {actorLabel(row.createdBy, actorNames)}
                          {row.updatedBy && row.updatedBy !== row.createdBy ? (
                            <div style={{ fontSize: 11 }} title={t("admin.list.lastEditedBy", { email: row.updatedBy })}>
                              {t("admin.list.changedBy", { name: actorLabel(row.updatedBy, actorNames) })}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.publishedAt ? row.publishedAt.slice(0, 10) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
