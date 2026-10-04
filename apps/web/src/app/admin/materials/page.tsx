import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { MaterialTabs } from "@/components/admin/MaterialTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listMaterialCategories, searchMaterials } from "@/lib/admin/material-repository";
import { actorLabel, listAdminDisplayNames } from "@/lib/admin/user-admin-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABEL: Record<string, string> = { published: "已发布", draft: "草稿", archived: "已归档" };

/** 查找与修改 — the materials half of the screen articles and videos already have. */
export default async function AdminMaterialsPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [result, categories, actorNames] = await Promise.all([
    searchMaterials({
      q: params.q,
      category: params.category,
      status: params.status,
      page: Number(params.page ?? "1") || 1,
      pageSize: Number(params.pageSize ?? "20") || 20
    }),
    listMaterialCategories(),
    listAdminDisplayNames()
  ]);

  return (
    <AdminShell user={user}>
      <MaterialTabs active="search" />

      {!result.ready ? (
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>资料表还没有建立</h2>
          <p>请先运行 <code>supabase/content/migrations/017_materials.sql</code>。</p>
        </section>
      ) : (
        <>
          <form className="admin-card" method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, flex: "1 1 240px" }}>
              搜索
              <input className="admin-input" name="q" defaultValue={params.q ?? ""} placeholder="标题、简介或代号" />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              分类
              <select className="admin-input" name="category" defaultValue={params.category ?? ""}>
                <option value="">全部</option>
                {categories.rows.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}（{category.count}）
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              状态
              <select className="admin-input" name="status" defaultValue={params.status ?? ""}>
                <option value="">全部</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="archived">已归档</option>
              </select>
            </label>
            <button className="admin-btn admin-btn--primary" type="submit">查询</button>
            <Link className="admin-btn" href="/admin/materials">重置</Link>
          </form>

          <section className="admin-card">
            <p style={{ marginTop: 0, color: "#666", fontSize: 13 }}>共 {result.total} 项资料。</p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>预览</th>
                    <th>标题</th>
                    <th>分类</th>
                    <th>文件</th>
                    <th>状态</th>
                    <th>创建人</th>
                    <th>发布时间</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ color: "#777" }}>没有符合条件的资料。</td>
                    </tr>
                  ) : (
                    result.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.coverImage ? (
                            <img src={row.coverImage} alt="" style={{ width: 60, height: 60, objectFit: "contain", background: "#fafafa" }} />
                          ) : (
                            <span style={{ color: "#bbb", fontSize: 12 }}>无图</span>
                          )}
                        </td>
                        <td>
                          <Link href={`/admin/materials/${row.id}`}>{row.title}</Link>
                          {/* Same ★ the article and video tables use for 重要. */}
                          {row.featured ? <span title="重要" style={{ color: "#c8102e", fontSize: 15, marginLeft: 6 }}>★</span> : null}
                          <div style={{ color: "#888", fontSize: 12 }}>{row.summary.slice(0, 48)}</div>
                        </td>
                        <td>{row.categories.join("、") || <span style={{ color: "#bbb" }}>未分类</span>}</td>
                        <td>{row.fileCount}</td>
                        <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                        {/* Who added it to the CMS. */}
                        <td style={{ color: "#888", whiteSpace: "nowrap" }} title={row.createdBy || undefined}>
                          {actorLabel(row.createdBy, actorNames)}
                          {row.updatedBy && row.updatedBy !== row.createdBy ? (
                            <div style={{ fontSize: 11 }} title={`最后修改：${row.updatedBy}`}>
                              改：{actorLabel(row.updatedBy, actorNames)}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.publishedAt ? row.publishedAt.slice(0, 10) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
