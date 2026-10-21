import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { listRevisions } from "@/lib/admin/repository";
import { formatDateTime } from "@/lib/format";

export default async function AdminRevisionsPage() {
  const user = await requireAdminSessionUser();
  if (!can(user, "revisions.restore")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("admin.rev.title")}</h2>
          <p>你的账号没有权限打开这个页面。需要管理员或超级管理员权限。</p>
        </section>
      </AdminShell>
    );
  }
  const rows = await listRevisions(user.email);
  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.rev.title")}</h2>
        <p>{t("admin.rev.intro")}</p>
      </section>
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("admin.rev.col.time")}</th>
              <th>{t("admin.rev.col.type")}</th>
              <th>{t("admin.rev.col.entity")}</th>
              <th>{t("admin.rev.col.actor")}</th>
              <th>{t("admin.rev.col.snapshot")}</th>
            </tr>
          </thead>
          {/* 整张表是数据库里的修订记录（含 JSON 快照），每次有人保存内容就变。 */}
          <tbody data-snapshot="data">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>{t("admin.rev.empty")}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.entityType}</td>
                  <td>{row.entityId}</td>
                  <td>{row.createdBy}</td>
                  <td>
                    <code>{row.payload.slice(0, 80)}...</code>
                    <form method="post" action="/api/admin/revisions/restore" style={{ marginTop: 8 }}>
                      <input type="hidden" name="revisionId" value={row.id} />
                      <button className="admin-btn" type="submit">
                        {t("admin.rev.rollback")}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
