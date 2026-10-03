import { AdminShell } from "@/components/admin/AdminShell";
import { MaterialTabs } from "@/components/admin/MaterialTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listMaterialCategories } from "@/lib/admin/material-repository";

interface PageProps {
  searchParams: Promise<{ error?: string; msg?: string }>;
}

export default async function MaterialCategoriesPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;
  const { ready, rows } = await listMaterialCategories();

  return (
    <AdminShell user={user}>
      <MaterialTabs active="categories" />
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>资料分类 Material categories</h2>
        <p>
          可新增、重命名、排序；删除前需先移走该分类下的资料。
          分类名称可用中文，slug 请用英文（它出现在网址里）。
          「说明」是下载页上该分类卡片下的那段文字。
        </p>
        {params.error ? (
          <p style={{ margin: "8px 0 0", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>
            {decodeURIComponent(params.error)}
          </p>
        ) : null}
        {params.msg ? (
          <p style={{ margin: "8px 0 0", color: "#1f7a4d", background: "#f0fbf4", padding: "8px 10px" }}>
            {decodeURIComponent(params.msg)}
          </p>
        ) : null}
        {!ready ? (
          <p style={{ margin: "8px 0 0", color: "#8a6d1f", background: "#fffbe9", padding: "8px 10px" }}>
            还没有资料分类表。请先执行
            <code> supabase/content/migrations/017_materials.sql</code>。
          </p>
        ) : null}
      </section>

      {ready ? (
        <section className="admin-card">
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>排序</th>
                  <th>名称</th>
                  <th>Slug</th>
                  <th>说明</th>
                  <th style={{ width: 90 }}>已发布</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sortOrder}</td>
                    <td>{row.name}</td>
                    <td><code>{row.slug}</code></td>
                    <td style={{ color: "#666", fontSize: 13 }}>{row.summary}</td>
                    {/* Counted from the map, not stored: the whole reason these
                        moved off the hand-written page, where the numbers were
                        typed and wrong. */}
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
