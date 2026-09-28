import { AdminShell } from "@/components/admin/AdminShell";
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
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>分类管理</h2>
        <p>可新增、重命名分类；删除前需先移除该分类下文章映射。</p>
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
              <th>名称</th>
              <th>slug</th>
              <th>文章数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>暂无分类</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.slug}</td>
                  <td>{row.articleCount}</td>
                  <td>
                    <form method="post" action="/api/admin/content/categories" className="admin-toolbar">
                      <input type="hidden" name="id" value={row.id} />
                      <input className="admin-input" name="name" defaultValue={row.name} required />
                      <input className="admin-input" name="slug" defaultValue={row.slug} required />
                      <button className="admin-btn" type="submit">
                        更新
                      </button>
                    </form>
                    <form method="post" action="/api/admin/content/categories/delete" style={{ marginTop: 8 }}>
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
        <h3 style={{ marginTop: 0 }}>新增分类</h3>
        <form method="post" action="/api/admin/content/categories" className="admin-toolbar">
          <input className="admin-input" name="name" placeholder="分类名称" required />
          <input className="admin-input" name="slug" placeholder="slug（可留空自动生成）" />
          <button className="admin-btn admin-btn-primary" type="submit">
            新增
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
