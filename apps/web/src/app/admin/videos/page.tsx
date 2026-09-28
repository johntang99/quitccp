import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideos } from "@/lib/admin/repository";

export default async function AdminVideosPage() {
  const user = await requireAdminSessionUser();
  const rows = await listVideos(user.email);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>视频编辑系统</h2>
        <p>维护视频元数据（标题、平台 ID、封面资源、下载资源、状态）。</p>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>slug</th>
              <th>状态</th>
              <th>时长(秒)</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无视频</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.slug}</td>
                  <td>{row.status}</td>
                  <td>{row.durationSeconds ?? "-"}</td>
                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                  <td>
                    <form method="post" action="/api/admin/content/videos/delete">
                      <input type="hidden" name="id" value={row.id} />
                      <button className="admin-btn" type="submit">
                        删除
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>新增/更新视频</h3>
        <form method="post" action="/api/admin/content/videos" style={{ display: "grid", gap: 10 }}>
          <div className="admin-toolbar">
            <input className="admin-input" name="id" placeholder="id (可留空自动生成)" />
            <input className="admin-input" name="slug" placeholder="slug" required />
            <input className="admin-input" name="title" placeholder="title" required />
            <input className="admin-input" name="durationSeconds" placeholder="duration seconds" />
            <input className="admin-input" name="coverAssetId" placeholder="cover asset id" />
            <input className="admin-input" name="downloadAssetId" placeholder="download asset id" />
            <select className="admin-select" name="status" defaultValue="draft">
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </div>
          <textarea className="admin-textarea" name="description" placeholder="视频描述" />
          <textarea
            className="admin-textarea"
            name="platformIdsJson"
            defaultValue={'{"youtube":"", "ganjingworld":"", "rumble":""}'}
          />
          <button className="admin-btn admin-btn-primary" type="submit">
            保存视频
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
