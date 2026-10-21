import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { canAccessDeclarations, requireAdminSessionUser } from "@/lib/admin/auth";
import { listDeclarationsForAdmin } from "@/lib/admin/declarations-repository";
import { formatDateTime } from "@/lib/format";

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
  rejected: t("admin.decl.status.rejected")
};

const CERT_STATUS_LABEL: Record<string, string> = {
  issued: t("admin.decl.cert.issued"),
  revoked: t("admin.decl.cert.revoked"),
  pending: t("admin.decl.cert.pending")
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
          <h2 style={{ marginTop: 0 }}>{t("admin.decl.title")}</h2>
          <p>
            {t("admin.decl.noPermission", { role: user.role })}
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
        <h2 style={{ marginTop: 0 }}>{t("admin.decl.title")}</h2>
        <p>
          {tRich("admin.decl.intro", { pending: <b>{t("admin.decl.introPending")}</b> })}
          {tRich("admin.decl.counts", { pending: <b>{result.pendingCount}</b>, total: result.total })}
        </p>
        <p className="muted">
          {t("admin.decl.sensitiveNote")}
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
            <option value="">{t("admin.list.allStatuses")}</option>
            <option value="pending_review">{t("admin.decl.status.pending_review")}</option>
            <option value="published">{t("admin.decl.status.published")}</option>
            <option value="rejected">{t("admin.decl.status.rejected")}</option>
          </select>
          <select className="admin-select" name="source" defaultValue={filters.source ?? ""}>
            <option value="">{t("admin.decl.allSources")}</option>
            <option value="public">{t("admin.decl.source.public")}</option>
            <option value="staff">{t("admin.decl.source.staff")}</option>
            <option value="legacy">{t("admin.decl.source.legacy")}</option>
          </select>
          <select
            className="admin-select"
            name="wantsCertificate"
            defaultValue={filters.wantsCertificate ?? ""}
          >
            <option value="">{t("admin.decl.certFilterAll")}</option>
            <option value="1">{t("admin.decl.certFilterOnly")}</option>
          </select>
          <input className="admin-input" name="pageSize" defaultValue={String(result.pageSize)} />
          <button className="admin-btn" type="submit">
            {t("admin.decl.filter")}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("admin.decl.col.id")}</th>
              <th>{t("admin.decl.col.name")}</th>
              <th>{t("admin.decl.col.orgs")}</th>
              <th>{t("admin.decl.col.statement")}</th>
              <th>{t("admin.list.col.status")}</th>
              <th>{t("admin.decl.col.cert")}</th>
              <th>{t("admin.vid.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={7}>{t("admin.decl.empty")}</td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <tr key={row.id} data-snapshot="data">
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatSequence(row.sequenceNumber)}
                    <br />
                    <span className="muted">{formatDateTime(row.createdAt)}</span>
                    <br />
                    <span className="muted">{row.source}</span>
                  </td>
                  <td>
                    {row.alias}
                    <br />
                    <span className="muted">{row.region ?? t("admin.decl.noRegion")}</span>
                  </td>
                  <td>{row.organizationScopes.join("、") || "-"}</td>
                  <td style={{ maxWidth: 360 }}>
                    {/* Collapsed by default so a page of the queue cannot leak
                        many statements at once to a passing screen or capture. */}
                    <details>
                      <summary style={{ cursor: "pointer" }}>{t("admin.decl.viewFull", { n: row.statement.length })}</summary>
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
                        <span className="muted">{t("admin.decl.certRequested")}</span>
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
                              {t("admin.decl.revoke")}
                            </button>
                          </form>
                        ) : null}
                      </>
                    ) : row.status !== "published" ? (
                      <span className="muted">
                        {t(row.status === "rejected" ? "admin.decl.cannotIssue" : "admin.decl.needsReview")}
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
                          placeholder={t("admin.decl.certNamePlaceholder")}
                          defaultValue={row.alias}
                        />
                        <button className="admin-btn" type="submit">
                          {t("admin.decl.issueCert")}
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
                        <option value="publish">{t("admin.decl.action.publish")}</option>
                        <option value="reject">{t("admin.decl.action.reject")}</option>
                        <option value="return_to_pending">{t("admin.decl.action.return")}</option>
                      </select>
                      <button className="admin-btn admin-btn-primary" type="submit" style={{ marginLeft: 6 }}>
                        {t("admin.decl.submit")}
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
              {t("admin.decl.prevPage")}
            </a>
          ) : null}
          <span className="muted">
            {t("admin.decl.pageOf", { page, total: totalPages })}
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
