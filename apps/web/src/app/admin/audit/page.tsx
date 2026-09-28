import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listAudits } from "@/lib/admin/repository";

export default async function AdminAuditPage() {
  const user = await requireAdminSessionUser();
  const rows = await listAudits(user.email);
  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>审计日志</h2>
        <p>记录内容读取与写入事件，满足追责与合规要求。</p>
      </section>
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>账号</th>
              <th>动作</th>
              <th>对象</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无记录</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
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
