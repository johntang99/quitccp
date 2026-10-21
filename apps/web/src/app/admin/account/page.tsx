import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/user-admin-repository";

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

/** Every role has this page: changing your own password is not a privilege. */
export default async function AdminAccountPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.account.title")}</h2>
        <p>
          {user.email}　·　{ROLE_LABELS[user.role] ?? user.role}
        </p>
        {params.error ? <p className="users-error">{decodeURIComponent(params.error)}</p> : null}
        {params.ok ? <p className="users-ok">密码已更新，其他设备上的登录已退出。</p> : null}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.account.changePassword")}</h3>
        <p className="dash-note">
          {t("admin.account.note")}
        </p>
        <form method="post" action="/api/admin/account/password" className="account-form">
          <label>
            <span>{t("admin.account.current")}</span>
            <input className="admin-input" name="currentPassword" type="password" required />
          </label>
          <label>
            <span>{t("admin.account.new", { n: MIN_PASSWORD_LENGTH })}</span>
            <input className="admin-input" name="newPassword" type="password"
                   minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <label>
            <span>{t("admin.account.again")}</span>
            <input className="admin-input" name="confirmPassword" type="password"
                   minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <button className="admin-btn admin-btn-primary" type="submit">{t("admin.account.save")}</button>
        </form>
      </section>
    </AdminShell>
  );
}
