import { AdminShell } from "@/components/admin/AdminShell";
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
        <h2 style={{ marginTop: 0 }}>我的账号</h2>
        <p>
          {user.email}　·　{ROLE_LABELS[user.role] ?? user.role}
        </p>
        {params.error ? <p className="users-error">{decodeURIComponent(params.error)}</p> : null}
        {params.ok ? <p className="users-ok">密码已更新，其他设备上的登录已退出。</p> : null}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>修改密码</h3>
        <p className="dash-note">
          需要先输入当前密码。改完之后，你在其他设备上的登录会被退出。
          没有人能看到你的密码——管理员也只能重设，看不到。
        </p>
        <form method="post" action="/api/admin/account/password" className="account-form">
          <label>
            <span>当前密码</span>
            <input className="admin-input" name="currentPassword" type="password" required />
          </label>
          <label>
            <span>新密码（至少 {MIN_PASSWORD_LENGTH} 位）</span>
            <input className="admin-input" name="newPassword" type="password"
                   minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <label>
            <span>再输入一次</span>
            <input className="admin-input" name="confirmPassword" type="password"
                   minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <button className="admin-btn admin-btn-primary" type="submit">保存新密码</button>
        </form>
      </section>
    </AdminShell>
  );
}
