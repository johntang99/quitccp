import Link from "next/link";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { AdminShell } from "@/components/admin/AdminShell";
import { canBulkPublish, requireAdminSessionUser } from "@/lib/admin/auth";
import { listFaqCategories, searchFaqs } from "@/lib/admin/faq-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABEL: Record<string, string> = {
  published: t("admin.status.published"),
  draft: t("admin.status.draft"),
  archived: t("admin.status.archived")
};

/**
 * 常见问答 — grouped by category, in the order the public page shows them.
 *
 * Deliberately not the flat newest-first table articles use: the whole point of
 * this screen is the order inside a category, and a flat list hides it.
 */
export default async function AdminFaqPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [{ ready, rows: categories }, result] = await Promise.all([
    listFaqCategories(),
    searchFaqs({ q: params.q, category: params.category, status: params.status })
  ]);

  if (!ready || !result.ready) {
    return (
      <AdminShell user={user}>
      <h2 style={{ margin: "0 0 12px" }}>{t("admin.faq.title")}</h2>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("admin.faq.noTable")}</h2>
          <p>
            {t("admin.faq.noTableBody")}
            <code>supabase/content/migrations/023_faq.sql</code>
          </p>
          <p style={{ color: "#666" }}>
            {t("admin.faq.noTableBody2")}
          </p>
        </section>
      </AdminShell>
    );
  }

  const byCategory = new Map<string, typeof result.rows>();
  for (const row of result.rows) {
    const bucket = byCategory.get(row.categoryId) ?? [];
    bucket.push(row);
    byCategory.set(row.categoryId, bucket);
  }
  const canPublish = canBulkPublish(user);

  return (
    <AdminShell user={user}>
      <h2 style={{ margin: "0 0 12px" }}>{t("admin.faq.title")}</h2>
      <section className="admin-card">
        <div className="admin-toolbar">
          <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="admin-input" name="q" placeholder={t("admin.faq.searchPlaceholder")} defaultValue={params.q ?? ""} />
            <select className="admin-select" name="status" defaultValue={params.status ?? ""}>
              <option value="">{t("admin.list.allStatuses")}</option>
              <option value="published">{t("admin.status.published")}</option>
              <option value="draft">{t("admin.status.draft")}</option>
              <option value="archived">{t("admin.status.archived")}</option>
            </select>
            <button className="admin-btn" type="submit">
              {t("admin.faq.search")}
            </button>
          </form>
          <Link className="admin-btn admin-btn-primary" href="/admin/faq/new">
            {t("admin.faq.new")}
          </Link>
          <Link className="admin-btn" href="/admin/faq/categories">
            {t("admin.faq.manageCategories")}
          </Link>
          <span style={{ color: "#666" }}>{t("admin.faq.total", { n: result.total })}</span>
        </div>
      </section>

      {categories.map((category) => {
        const rows = byCategory.get(category.id) ?? [];
        return (
          <section className="admin-card" key={category.id} style={{ marginTop: 14 }}>
            <h3 style={{ margin: "0 0 4px 0" }}>
              {category.name} <span style={{ color: "#888", fontWeight: 400 }}>{t("admin.faq.inCategory", { n: rows.length })}</span>
            </h3>
            {category.summary ? <p style={{ margin: "0 0 10px", color: "#666" }}>{category.summary}</p> : null}
            {rows.length === 0 ? (
              <p style={{ color: "#888", margin: 0 }}>{t("admin.faq.emptyCategory")}</p>
            ) : (
              <table className="admin-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 92 }}>{t("admin.faq.col.order")}</th>
                    <th>{t("admin.faq.col.question")}</th>
                    <th style={{ width: 90 }}>{t("admin.faq.col.answer")}</th>
                    <th style={{ width: 90 }}>{t("admin.list.col.status")}</th>
                    <th style={{ width: 160 }}>{t("admin.vid.col.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} data-snapshot="data">
                      {/*
                        Both numbers, because they are not the same number.

                        The left one is where the row sits; the right one is what
                        the edit form's 排序 box holds. They drift apart as soon as
                        two questions share a value or an editor leaves gaps -- and
                        an editor who types the number they read on the left would
                        move the row somewhere they did not intend.
                      */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        {index + 1}
                        <span style={{ color: "#999", fontSize: 12 }}> · {row.position}</span>
                      </td>
                      <td>
                        <Link href={`/admin/faq/${row.id}`}>{row.question}</Link>
                      </td>
                      <td style={{ color: "#777" }}>{t("admin.faq.answerChars", { n: row.answerChars })}</td>
                      <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <form method="post" action="/api/admin/content/faq/move">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button className="admin-btn" type="submit" disabled={index === 0} title={t("admin.faq.moveUp")}>
                            ↑
                          </button>
                        </form>
                        <form method="post" action="/api/admin/content/faq/move">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            className="admin-btn"
                            type="submit"
                            disabled={index === rows.length - 1}
                            title={t("admin.faq.moveDown")}
                          >
                            ↓
                          </button>
                        </form>
                        {canPublish ? (
                          <form method="post" action="/api/admin/content/faq/delete">
                            <input type="hidden" name="id" value={row.id} />
                            <button className="admin-btn" type="submit">
                              {t("admin.list.delete")}
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      {(byCategory.get("") ?? []).length > 0 ? (
        <section className="admin-card" style={{ marginTop: 14 }}>
          <h3 style={{ margin: "0 0 10px 0" }}>{t("admin.faq.uncategorised")}</h3>
          <ul>
            {(byCategory.get("") ?? []).map((row) => (
              <li key={row.id} data-snapshot="data">
                <Link href={`/admin/faq/${row.id}`}>{row.question}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
