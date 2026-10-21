import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { listAudits } from "@/lib/admin/repository";
import { formatDateTime } from "@/lib/format";

export default async function AdminAuditPage() {
  const user = await requireAdminSessionUser();
  if (!can(user, "audit.read")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("admin.audit.title")}</h2>
          <p>你的账号没有权限打开这个页面。需要管理员或超级管理员权限。</p>
        </section>
      </AdminShell>
    );
  }
  const rows = await listAudits(user.email);
  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.audit.title")}</h2>
        <p>{t("admin.audit.intro")}</p>
      </section>
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("admin.rev.col.time")}</th>
              <th>{t("admin.audit.col.account")}</th>
              <th>{t("admin.audit.col.action")}</th>
              <th>{t("admin.audit.col.target")}</th>
              <th>{t("admin.audit.col.detail")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>{t("admin.audit.empty")}</td>
              </tr>
            ) : (
              rows.map((row) => (
                /* 日志行是数据，不是文案 —— 而且我每打开一次这一页就会写一行新的。 */
                <tr key={row.id} data-snapshot="data">
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.actor}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.targetType}/{row.targetId}
                  </td>
                  <td>{row.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
