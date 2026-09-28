import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listRevisions } from "@/lib/admin/repository";

export default async function AdminRevisionsPage() {
  const user = await requireAdminSessionUser();
  const rows = await listRevisions(user.email);
  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>修订历史</h2>
        <p>页面和文章每次写入都会生成修订快照，支持比对和回滚。</p>
      </section>
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>实体</th>
              <th>操作者</th>
              <th>快照</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无修订记录</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.entityType}</td>
                  <td>{row.entityId}</td>
                  <td>{row.createdBy}</td>
                  <td>
                    <code>{row.payload.slice(0, 80)}...</code>
                    <form method="post" action="/api/admin/revisions/restore" style={{ marginTop: 8 }}>
                      <input type="hidden" name="revisionId" value={row.id} />
                      <button className="admin-btn" type="submit">
                        回滚到此版本
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
