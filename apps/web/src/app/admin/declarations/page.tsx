import { AdminShell } from "@/components/admin/AdminShell";
import { canAccessDeclarations, requireAdminSessionUser } from "@/lib/admin/auth";
import { listDeclarationsForAdmin } from "@/lib/admin/declarations-repository";

interface DeclarationsPageProps {
  searchParams: Promise<{
    status?: string;
    source?: string;
    wantsCertificate?: string;
    page?: string;
    pageSize?: string;
    ok?: string;
    error?: string;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: "待审核",
  published: "已公开",
  rejected: "已拒绝"
};

const CERT_STATUS_LABEL: Record<string, string> = {
  issued: "已签发",
  revoked: "已作废",
  pending: "待处理"
};

function formatSequence(value: string | null): string {
  if (!value) return "-";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `No. ${parsed.toLocaleString("en-US")}` : value;
}

export default async function AdminDeclarationsPage({ searchParams }: DeclarationsPageProps) {
  const user = await requireAdminSessionUser();
  const filters = await searchParams;

  if (!canAccessDeclarations(user)) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>三退声明队列</h2>
          <p>
            你的角色（{user.role}）无权查看声明队列。声明属于服务域的敏感数据，仅限
            super_admin 访问。
          </p>
        </section>
      </AdminShell>
    );
  }

  const page = Math.max(Number(filters.page ?? "1") || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize ?? "25") || 25, 1), 100);

  const result = await listDeclarationsForAdmin(
    {
      status: filters.status,
      source: filters.source,
      wantsCertificate: filters.wantsCertificate === "1",
      page,
      pageSize
    },
    user.email
  );

  // Round-trips the operator's filter and page position through each action so
  // reviewing a row does not throw them back to an unfiltered page one.
  const currentQuery = (() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.source) params.set("source", filters.source);
    if (filters.wantsCertificate === "1") params.set("wantsCertificate", "1");
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 25) params.set("pageSize", String(pageSize));
    const query = params.toString();
    return query ? `?${query}` : "";
  })();

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams(currentQuery.replace(/^\?/, ""));
    if (targetPage > 1) params.set("page", String(targetPage));
    else params.delete("page");
    const query = params.toString();
    return query ? `/admin/declarations?${query}` : "/admin/declarations";
  };

  const totalPages = Math.max(Math.ceil(result.total / result.pageSize), 1);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>三退声明队列</h2>
        <p>
          公开提交的声明先进入 <b>待审核</b>，经人工确认后才会在站点上公开。
          待审核 <b>{result.pendingCount}</b> 条，当前筛选共 {result.total} 条。
        </p>
        <p className="muted">
          声明正文属于敏感数据，默认折叠。展开、筛选与处理都会记入服务审计日志
          （service_audit_logs）。
        </p>

        {filters.ok ? (
          <p role="status" style={{ color: "#1d6b3f", fontWeight: 600 }}>
            {filters.ok}
          </p>
        ) : null}
        {filters.error ? (
          <p role="alert" style={{ color: "#a32424", fontWeight: 600 }}>
            {filters.error}
          </p>
        ) : null}

        <form className="admin-toolbar" method="get">
          <select className="admin-select" name="status" defaultValue={filters.status ?? ""}>
            <option value="">全部状态</option>
            <option value="pending_review">待审核</option>
            <option value="published">已公开</option>
            <option value="rejected">已拒绝</option>
          </select>
          <select className="admin-select" name="source" defaultValue={filters.source ?? ""}>
            <option value="">全部来源</option>
            <option value="public">public（网站提交）</option>
            <option value="staff">staff（内部录入）</option>
            <option value="legacy">legacy（历史迁移）</option>
          </select>
          <select
            className="admin-select"
            name="wantsCertificate"
            defaultValue={filters.wantsCertificate ?? ""}
          >
            <option value="">是否申请证明（全部）</option>
            <option value="1">仅申请了证明</option>
          </select>
          <input className="admin-input" name="pageSize" defaultValue={String(result.pageSize)} />
          <button className="admin-btn" type="submit">
            筛选
          </button>
        </form>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>署名 / 地区</th>
              <th>退出组织</th>
              <th>声明内容</th>
              <th>状态</th>
              <th>证明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={7}>没有符合条件的声明</td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatSequence(row.sequenceNumber)}
                    <br />
                    <span className="muted">{new Date(row.createdAt).toLocaleString()}</span>
                    <br />
                    <span className="muted">{row.source}</span>
                  </td>
                  <td>
                    {row.alias}
                    <br />
                    <span className="muted">{row.region ?? "未填写"}</span>
                  </td>
                  <td>{row.organizationScopes.join("、") || "-"}</td>
                  <td style={{ maxWidth: 360 }}>
                    {/* Collapsed by default so a page of the queue cannot leak
                        many statements at once to a passing screen or capture. */}
                    <details>
                      <summary style={{ cursor: "pointer" }}>查看全文（{row.statement.length} 字）</summary>
                      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, marginBottom: 0 }}>
                        {row.statement}
                      </p>
                    </details>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {STATUS_LABEL[row.status] ?? row.status}
                    {row.wantsCertificate ? (
                      <>
                        <br />
                        <span className="muted">已申请证明</span>
                      </>
                    ) : null}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.certificate ? (
                      <>
                        <span style={{ fontFamily: "var(--mono)" }}>{row.certificate.serialNumber}</span>
                        <br />
                        <span className="muted">
                          {CERT_STATUS_LABEL[row.certificate.status] ?? row.certificate.status}
                        </span>
                        {row.certificate.status !== "revoked" ? (
                          <form
                            method="post"
                            action="/api/admin/declarations/certificates/revoke"
                            style={{ marginTop: 6 }}
                          >
                            <input type="hidden" name="certificateId" value={row.certificate.id} />
                            <input type="hidden" name="returnTo" value={currentQuery} />
                            <button className="admin-btn" type="submit">
                              作废
                            </button>
                          </form>
                        ) : null}
                      </>
                    ) : row.status !== "published" ? (
                      <span className="muted">
                        {row.status === "rejected" ? "不可签发" : "需先通过审核"}
                      </span>
                    ) : (
                      <form
                        method="post"
                        action="/api/admin/declarations/certificates"
                        style={{ display: "grid", gap: 6 }}
                      >
                        <input type="hidden" name="declarationId" value={row.id} />
                        <input type="hidden" name="returnTo" value={currentQuery} />
                        <input
                          className="admin-input"
                          name="holderName"
                          placeholder="证明上的姓名"
                          defaultValue={row.alias}
                        />
                        <button className="admin-btn" type="submit">
                          签发证明
                        </button>
                      </form>
                    )}
                  </td>
                  <td>
                    <form method="post" action="/api/admin/declarations/review">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="returnTo" value={currentQuery} />
                      <select
                        className="admin-select"
                        name="decision"
                        defaultValue={row.status === "pending_review" ? "publish" : "return_to_pending"}
                      >
                        <option value="publish">通过并公开</option>
                        <option value="reject">拒绝</option>
                        <option value="return_to_pending">退回待审</option>
                      </select>
                      <button className="admin-btn admin-btn-primary" type="submit" style={{ marginLeft: 6 }}>
                        提交
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {page > 1 ? (
            <a className="admin-btn" href={pageHref(page - 1)}>
              上一页
            </a>
          ) : null}
          <span className="muted">
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages ? (
            <a className="admin-btn" href={pageHref(page + 1)}>
              下一页
            </a>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
