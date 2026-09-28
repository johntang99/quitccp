import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listArticles } from "@/lib/admin/repository";

interface ArticlePageProps {
  searchParams: Promise<{
    status?: string;
    locale?: string;
    category?: string;
    q?: string;
    pageSize?: string;
    cursor?: string;
    trail?: string;
  }>;
}

export default async function AdminArticlesPage({ searchParams }: ArticlePageProps) {
  const user = await requireAdminSessionUser();
  const filters = await searchParams;
  const pageSize = Math.min(Math.max(Number(filters.pageSize ?? "20") || 20, 1), 200);
  const currentCursor = filters.cursor?.trim() || undefined;
  const trailTokens = (filters.trail ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const ROOT_SENTINEL = "ROOT";

  const result = await listArticles(
    {
      page: 1,
      pageSize,
      status: filters.status,
      locale: filters.locale,
      category: filters.category,
      q: filters.q,
      cursor: currentCursor
    },
    user.email
  );
  const rows = result.rows;

  const buildCursorHref = (cursor?: string, trail?: string[]) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.locale) params.set("locale", filters.locale);
    if (filters.category) params.set("category", filters.category);
    params.set("pageSize", String(result.pageSize));
    if (cursor) params.set("cursor", cursor);
    if (trail && trail.length > 0) params.set("trail", trail.join(","));
    return `/admin/articles?${params.toString()}`;
  };

  const prevToken = trailTokens.length > 0 ? trailTokens[trailTokens.length - 1] : null;
  const prevCursor = prevToken && prevToken !== ROOT_SENTINEL ? prevToken : undefined;
  const prevTrail = trailTokens.slice(0, -1);
  const nextTrail = [...trailTokens, currentCursor ?? ROOT_SENTINEL];

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>文章管理</h2>
        <form className="admin-toolbar" method="get">
          <input className="admin-input" name="q" placeholder="搜索标题/正文" defaultValue={filters.q ?? ""} />
          <select className="admin-select" name="status" defaultValue={filters.status ?? ""}>
            <option value="">全部状态</option>
            <option value="draft">draft</option>
            <option value="review">review</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
          <select className="admin-select" name="locale" defaultValue={filters.locale ?? ""}>
            <option value="">全部语言</option>
            <option value="zh">zh</option>
            <option value="en">en</option>
          </select>
          <input className="admin-input" name="category" placeholder="分类" defaultValue={filters.category ?? ""} />
          <input className="admin-input" name="pageSize" defaultValue={String(result.pageSize)} />
          <button className="admin-btn" type="submit">
            筛选
          </button>
        </form>
        <p className="muted">
          {result.cursorApplied
            ? `游标分页：本页 ${rows.length} 条（游标模式下不显示总页数）`
            : `共 ${result.total} 条（首屏）`}
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>状态</th>
              <th>分类</th>
              <th>遗留ID</th>
              <th>更新</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>{row.status}</td>
                <td>{row.category}</td>
                <td>{row.legacyId ?? "-"}</td>
                <td>
                  {new Date(row.updatedAt).toLocaleString()}
                  <form method="post" action="/api/admin/content/articles/review" style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={row.id} />
                    <select className="admin-select" name="decision" defaultValue="request_changes">
                      <option value="request_changes">退回修改</option>
                      <option value="approved">批准发布</option>
                      <option value="rejected">拒绝/归档</option>
                    </select>
                    <button className="admin-btn" type="submit" style={{ marginLeft: 6 }}>
                      提交审校
                    </button>
                  </form>
                  <form method="post" action="/api/admin/content/articles/delete" style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="admin-btn" type="submit">
                      删除文章
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {prevToken ? <a className="admin-btn" href={buildCursorHref(prevCursor, prevTrail)}>上一页</a> : null}
          {result.nextCursor ? (
            <a className="admin-btn" href={buildCursorHref(result.nextCursor, nextTrail)}>
              下一页
            </a>
          ) : null}
        </div>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>新建/更新文章</h3>
        <form method="post" action="/api/admin/content/articles" style={{ display: "grid", gap: 10 }}>
          <div className="admin-toolbar">
            <input className="admin-input" name="id" placeholder="id (可留空自动生成)" />
            <input className="admin-input" name="slug" placeholder="slug" required />
            <input className="admin-input" name="title" placeholder="title" required />
            <input className="admin-input" name="section" defaultValue="news" required />
            <input className="admin-input" name="locale" defaultValue="zh" required />
            <input className="admin-input" name="category" defaultValue="news" required />
            <input className="admin-input" name="tags" placeholder="标签(逗号分隔)" defaultValue="动态" />
            <input className="admin-input" name="legacyUrl" placeholder="legacy url" />
            <input className="admin-input" name="legacyId" placeholder="legacy id" />
            <select className="admin-select" name="status" defaultValue="draft">
              <option value="draft">draft</option>
              <option value="review">review</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </div>
          <textarea className="admin-textarea" name="bodyMarkdown" placeholder="Markdown 正文" />
          <button className="admin-btn admin-btn-primary" type="submit">
            保存文章
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>批量操作</h3>
        <form method="post" action="/api/admin/content/articles/bulk" className="admin-toolbar">
          <input className="admin-input" name="ids" placeholder="a_1,a_2,a_3" />
          <select className="admin-select" name="action">
            <option value="publish">批量发布</option>
            <option value="archive">批量归档</option>
            <option value="review">批量送审</option>
          </select>
          <button className="admin-btn" type="submit">
            执行
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
