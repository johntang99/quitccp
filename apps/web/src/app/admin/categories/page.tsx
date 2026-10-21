import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { CategoryRowActions } from "@/components/admin/CategoryRowActions";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listCategories } from "@/lib/admin/repository";

interface AdminCategoriesPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const user = await requireAdminSessionUser();
  const rows = await listCategories(user.email);
  const params = await searchParams;

  return (
    <AdminShell user={user}>
      <ArticleTabs active="categories" />
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.cat.title")}</h2>
        <p>
          {t("admin.cat.intro1")}
          <br />
          {t("admin.cat.intro2")}
          <br />
          {t("admin.cat.intro3")}
          <br />
          {tRich("admin.cat.intro4", { path: <code>/news/&lt;slug&gt;</code> })}

        </p>
        {params.error ? (
          <p style={{ margin: "8px 0 0", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>
            {decodeURIComponent(params.error)}
          </p>
        ) : null}
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>{t("admin.cat.col.order")}</th>
              <th style={{ width: 150 }}>{t("admin.cat.col.name")}</th>
              <th style={{ width: 170 }}>slug</th>
              <th style={{ width: 70 }}>{t("admin.cat.col.count")}</th>
              <th style={{ width: 86 }}>{t("admin.cat.col.public")}</th>
              <th>{t("admin.cat.col.blurb")}</th>
              <th style={{ width: 110 }}>{t("admin.cat.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>{t("admin.cat.empty")}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} data-snapshot="data">
                  <td>{row.sortOrder}</td>
                  <td>{row.name}</td>
                  <td>{row.slug}</td>
                  <td>{row.articleCount}</td>
                  <td>
                    {/* 勾上才有 /news/<slug> 页面和新闻页顶部那个 tab。
                        隐藏字段表明「这张表单管这个开关」：复选框不勾时浏览器
                        什么都不发，没有它就分不清「取消勾选」和「这张表单不碰
                        它」—— 新建分类那张表单正是后者。 */}
                    <input type="hidden" name="hasListingFlag" value="1" form={`ac-${row.id}`} />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        name="isNewsListing"
                        value="1"
                        form={`ac-${row.id}`}
                        defaultChecked={row.isNewsListing}
                        aria-label={t("admin.cat.aria.publicToggle", { name: row.name })}
                      />
                      <span>{t(row.isNewsListing ? "admin.cat.public" : "admin.cat.notPublic")}</span>
                    </label>
                  </td>
                  <td>
                    {/* In its own cell but part of the row's form, tied by
                        `form={…}`: a <form> cannot span table cells, and
                        burying the description in the last column would hide
                        it behind a scrollbar. */}
                    <textarea
                      className="admin-input"
                      form={`ac-${row.id}`}
                      name="description"
                      defaultValue={row.description}
                      rows={2}
                      placeholder={t("admin.cat.blurbPlaceholder")}
                      style={{ width: "100%", minWidth: 260, resize: "vertical" }}
                      aria-label={t("admin.cat.aria.blurb", { name: row.name })}
                    />
                  </td>
                  <td>
                    <form
                      id={`ac-${row.id}`}
                      method="post"
                      action="/api/admin/content/categories"
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
                      <input
                        className="admin-input"
                        name="name"
                        defaultValue={row.name}
                        aria-label={t("admin.cat.aria.name", { name: row.name })}
                        required
                      />
                    </form>
                    <div style={{ marginTop: 6 }}>
                      <CategoryRowActions
                        formId={`ac-${row.id}`}
                        id={row.id}
                        name={row.name}
                        count={row.articleCount}
                        kind="article"
                        deleteAction="/api/admin/content/categories/delete"
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
        <form method="post" action="/api/admin/content/categories" className="admin-toolbar">
          <input className="admin-input" name="name" placeholder={t("admin.cat.namePlaceholder")} required />
          <input
            className="admin-input"
            name="slug"
            placeholder={t("admin.cat.slugPlaceholder")}
          />
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
