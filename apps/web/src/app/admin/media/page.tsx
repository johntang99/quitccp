import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listMedia } from "@/lib/admin/repository";

export default async function AdminMediaPage() {
  const user = await requireAdminSessionUser();
  const rows = await listMedia(user.email);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>媒体与资源管理</h2>
        <p>支持图片、文档下载和视频封面元数据。</p>
      </section>
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>URL</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>暂无资源</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.type}</td>
                  <td>{row.url}</td>
                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>新增资源</h3>
        <form method="post" action="/api/admin/content/media" className="admin-toolbar">
          <input className="admin-input" name="id" placeholder="id (可留空自动生成)" />
          <input className="admin-input" name="name" placeholder="name" required />
          <select className="admin-select" name="type">
            <option value="image">image</option>
            <option value="document">document</option>
            <option value="video-cover">video-cover</option>
          </select>
          <input className="admin-input" name="url" placeholder="https://..." required />
          <button className="admin-btn admin-btn-primary" type="submit">
            保存资源
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
