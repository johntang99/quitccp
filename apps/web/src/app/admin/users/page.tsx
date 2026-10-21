import Link from "next/link";
import { t } from "@/lib/i18n";
import { AdminShell } from "@/components/admin/AdminShell";
import { PermissionTables } from "@/components/admin/PermissionTables";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import {
  ROLE_LABELS,
  assignableRoles,
  can,
  canModifyAccountOfRole
} from "@/lib/admin/permissions";
import { MIN_PASSWORD_LENGTH, listManagedUsers } from "@/lib/admin/user-admin-repository";
import { formatDateTime, formatNumber } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  if (!can(user, "users.view")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("admin.users.title")}</h2>
          <p>{t("admin.users.noPermission")}</p>
        </section>
      </AdminShell>
    );
  }

  const params = await searchParams;
  const users = await listManagedUsers();
  const grantable = assignableRoles(user);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>{t("admin.users.title")}</h2>
          <Link href="/admin/users/guide" className="admin-btn admin-btn-sm">
            {t("admin.users.guideLink")}
          </Link>
        </div>
        <p>
          {user.role === "super_admin"
            ? t("admin.users.introSuper")
            : t("admin.users.introAdmin")}
          {t("admin.users.passwordNote", { n: MIN_PASSWORD_LENGTH })}
        </p>
        {params.error ? <p className="users-error">{decodeURIComponent(params.error)}</p> : null}
        {params.ok ? <p className="users-ok">{t("admin.users.saved")}</p> : null}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.users.addTitle")}</h3>
        <form method="post" action="/api/admin/users" className="users-new">
          <input type="hidden" name="intent" value="create" />
          <label>
            <span>{t("admin.users.name")}</span>
            <input className="admin-input" name="name" required />
          </label>
          <label>
            <span>{t("admin.users.email")}</span>
            <input className="admin-input" name="email" type="email" required />
          </label>
          <label>
            <span>{t("admin.users.password", { n: MIN_PASSWORD_LENGTH })}</span>
            <input className="admin-input" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <label>
            <span>{t("admin.users.role")}</span>
            <select className="admin-input" name="role" defaultValue={grantable[grantable.length - 1]}>
              {grantable.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
          <button className="admin-btn admin-btn-primary" type="submit">{t("admin.users.add")}</button>
        </form>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.users.existing", { n: users.length })}</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("admin.users.name")}</th>
              <th>{t("admin.users.email")}</th>
              <th>{t("admin.users.role")}</th>
              <th>{t("admin.users.col.status")}</th>
              <th>{t("admin.users.col.lastLogin")}</th>
              <th>{t("admin.users.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const mayManage = canModifyAccountOfRole(user, row.role);
              const isSelf = row.id === user.id;
              return (
                <tr key={row.id} data-snapshot="data">
                  <td>
                    {mayManage && !isSelf ? (
                      <form method="post" action="/api/admin/users" className="users-inline">
                        <input type="hidden" name="intent" value="name" />
                        <input type="hidden" name="id" value={row.id} />
                        <input className="admin-input" name="name" defaultValue={row.name} />
                        <button className="admin-btn admin-btn-sm" type="submit">{t("admin.users.rename")}</button>
                      </form>
                    ) : (
                      row.name || "—"
                    )}
                  </td>
                  <td>
                    {row.email}
                    {isSelf ? <span className="users-self">{t("admin.users.self")}</span> : null}
                    {!row.hasAuthIdentity ? <span className="users-warn">{t("admin.users.noAuthIdentity")}</span> : null}
                  </td>
                  <td>
                    {mayManage && !isSelf ? (
                      <form method="post" action="/api/admin/users" className="users-inline">
                        <input type="hidden" name="intent" value="role" />
                        <input type="hidden" name="id" value={row.id} />
                        <select className="admin-input" name="role" defaultValue={row.role}>
                          {assignableRoles(user).map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                        <button className="admin-btn admin-btn-sm" type="submit">{t("admin.users.save")}</button>
                      </form>
                    ) : (
                      ROLE_LABELS[row.role] ?? row.role
                    )}
                  </td>
                  <td>{t(row.isActive ? "admin.users.active" : "admin.users.inactive")}</td>
                  <td>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : t("admin.users.never")}</td>
                  <td>
                    {mayManage && !isSelf ? (
                      <div className="users-actions">
                        <form method="post" action="/api/admin/users" className="users-inline">
                          <input type="hidden" name="intent" value="password" />
                          <input type="hidden" name="id" value={row.id} />
                          <input className="admin-input" name="password" type="password"
                                 placeholder={t("admin.users.newPasswordPlaceholder")} minLength={MIN_PASSWORD_LENGTH} required />
                          <button className="admin-btn admin-btn-sm" type="submit">{t("admin.users.resetPassword")}</button>
                        </form>
                        <form method="post" action="/api/admin/users" className="users-inline">
                          <input type="hidden" name="intent" value="active" />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="isActive" value={row.isActive ? "0" : "1"} />
                          <button className="admin-btn admin-btn-sm" type="submit">
                            {t(row.isActive ? "admin.users.deactivate" : "admin.users.reactivate")}
                          </button>
                        </form>
                        {/* Shown only when the server would actually allow it,
                            so the button and the rule never disagree. */}
                        {canModifyAccountOfRole(user, row.role) ? (
                          <form method="post" action="/api/admin/users" className="users-inline">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={row.id} />
                            <button className="admin-btn admin-btn-sm users-danger" type="submit">{t("admin.users.delete")}</button>
                          </form>
                        ) : null}
                      </div>
                    ) : (
                      <span className="users-muted">{isSelf ? "——" : t("admin.users.noRights")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>{t("admin.users.whoCanWhat")}</h3>
          <Link href="/admin/users/guide" className="admin-btn admin-btn-sm">
            {t("admin.users.fullGuide")}
          </Link>
        </div>
        <PermissionTables />
      </section>
    </AdminShell>
  );
}
