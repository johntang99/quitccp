import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { canBulkPublish, requireAdminSessionUser } from "@/lib/admin/auth";
import { listFaqCategories, searchFaqs } from "@/lib/admin/faq-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABEL: Record<string, string> = { published: "已发布", draft: "草稿", archived: "已归档" };

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
      <h2 style={{ margin: "0 0 12px" }}>常见问答</h2>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>还没有建表</h2>
          <p>
            常见问答需要先执行一次数据库迁移：
            <code>supabase/content/migrations/023_faq.sql</code>
          </p>
          <p style={{ color: "#666" }}>
            在 Supabase 控制台的 SQL Editor 里粘贴执行即可，和之前 22 个迁移的做法一样。执行后刷新本页。
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
      <h2 style={{ margin: "0 0 12px" }}>常见问答</h2>
      <section className="admin-card">
        <div className="admin-toolbar">
          <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="admin-input" name="q" placeholder="搜索问题" defaultValue={params.q ?? ""} />
            <select className="admin-select" name="status" defaultValue={params.status ?? ""}>
              <option value="">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
              <option value="archived">已归档</option>
            </select>
            <button className="admin-btn" type="submit">
              搜索
            </button>
          </form>
          <Link className="admin-btn admin-btn-primary" href="/admin/faq/new">
            新建问答
          </Link>
          <Link className="admin-btn" href="/admin/faq/categories">
            管理分类
          </Link>
          <span style={{ color: "#666" }}>共 {result.total} 条</span>
        </div>
      </section>

      {categories.map((category) => {
        const rows = byCategory.get(category.id) ?? [];
        return (
          <section className="admin-card" key={category.id} style={{ marginTop: 14 }}>
            <h3 style={{ margin: "0 0 4px 0" }}>
              {category.name} <span style={{ color: "#888", fontWeight: 400 }}>（{rows.length} 条）</span>
            </h3>
            {category.summary ? <p style={{ margin: "0 0 10px", color: "#666" }}>{category.summary}</p> : null}
            {rows.length === 0 ? (
              <p style={{ color: "#888", margin: 0 }}>这个分类下还没有问答。</p>
            ) : (
              <table className="admin-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 92 }}>顺序 · 排序值</th>
                    <th>问题</th>
                    <th style={{ width: 90 }}>答案</th>
                    <th style={{ width: 90 }}>状态</th>
                    <th style={{ width: 160 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
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
                      <td style={{ color: "#777" }}>{row.answerChars} 字</td>
                      <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <form method="post" action="/api/admin/content/faq/move">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button className="admin-btn" type="submit" disabled={index === 0} title="上移">
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
                            title="下移"
                          >
                            ↓
                          </button>
                        </form>
                        {canPublish ? (
                          <form method="post" action="/api/admin/content/faq/delete">
                            <input type="hidden" name="id" value={row.id} />
                            <button className="admin-btn" type="submit">
                              删除
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
          <h3 style={{ margin: "0 0 10px 0" }}>未分类</h3>
          <ul>
            {(byCategory.get("") ?? []).map((row) => (
              <li key={row.id}>
                <Link href={`/admin/faq/${row.id}`}>{row.question}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
