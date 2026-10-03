import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { ROLE_LABELS, assignableRoles, can, canManageRole } from "@/lib/admin/permissions";
import { MIN_PASSWORD_LENGTH, listManagedUsers } from "@/lib/admin/user-admin-repository";

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  if (!can(user, "users.view")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>用户管理</h2>
          <p>你的账号没有权限打开这个页面。需要管理员或超级管理员权限。</p>
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
        <h2 style={{ marginTop: 0 }}>用户管理</h2>
        <p>
          {user.role === "super_admin"
            ? "超级管理员可以添加管理员和编辑。"
            : "管理员可以添加编辑；添加或修改管理员需要超级管理员。"}
          　密码至少 {MIN_PASSWORD_LENGTH} 位，保存后任何人都看不到——忘记了只能重设。
        </p>
        {params.error ? <p className="users-error">{decodeURIComponent(params.error)}</p> : null}
        {params.ok ? <p className="users-ok">已保存。</p> : null}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>添加用户</h3>
        <form method="post" action="/api/admin/users" className="users-new">
          <input type="hidden" name="intent" value="create" />
          <label>
            <span>姓名</span>
            <input className="admin-input" name="name" required />
          </label>
          <label>
            <span>邮箱</span>
            <input className="admin-input" name="email" type="email" required />
          </label>
          <label>
            <span>密码（至少 {MIN_PASSWORD_LENGTH} 位）</span>
            <input className="admin-input" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <label>
            <span>角色</span>
            <select className="admin-input" name="role" defaultValue={grantable[grantable.length - 1]}>
              {grantable.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
          <button className="admin-btn admin-btn-primary" type="submit">添加</button>
        </form>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>现有用户（{users.length}）</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>姓名</th><th>邮箱</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const mayManage = canManageRole(user, row.role);
              const isSelf = row.id === user.id;
              return (
                <tr key={row.id}>
                  <td>
                    {mayManage && !isSelf ? (
                      <form method="post" action="/api/admin/users" className="users-inline">
                        <input type="hidden" name="intent" value="name" />
                        <input type="hidden" name="id" value={row.id} />
                        <input className="admin-input" name="name" defaultValue={row.name} />
                        <button className="admin-btn admin-btn-sm" type="submit">改名</button>
                      </form>
                    ) : (
                      row.name || "—"
                    )}
                  </td>
                  <td>
                    {row.email}
                    {isSelf ? <span className="users-self">（你自己）</span> : null}
                    {!row.hasAuthIdentity ? <span className="users-warn">无登录身份</span> : null}
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
                        <button className="admin-btn admin-btn-sm" type="submit">保存</button>
                      </form>
                    ) : (
                      ROLE_LABELS[row.role] ?? row.role
                    )}
                  </td>
                  <td>{row.isActive ? "正常" : "已停用"}</td>
                  <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString("zh-CN") : "从未"}</td>
                  <td>
                    {mayManage && !isSelf ? (
                      <div className="users-actions">
                        <form method="post" action="/api/admin/users" className="users-inline">
                          <input type="hidden" name="intent" value="password" />
                          <input type="hidden" name="id" value={row.id} />
                          <input className="admin-input" name="password" type="password"
                                 placeholder="设新密码" minLength={MIN_PASSWORD_LENGTH} required />
                          <button className="admin-btn admin-btn-sm" type="submit">重设密码</button>
                        </form>
                        <form method="post" action="/api/admin/users" className="users-inline">
                          <input type="hidden" name="intent" value="active" />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="isActive" value={row.isActive ? "0" : "1"} />
                          <button className="admin-btn admin-btn-sm" type="submit">
                            {row.isActive ? "停用" : "恢复"}
                          </button>
                        </form>
                        {user.role === "super_admin" ? (
                          <form method="post" action="/api/admin/users" className="users-inline">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={row.id} />
                            <button className="admin-btn admin-btn-sm users-danger" type="submit">删除</button>
                          </form>
                        ) : null}
                      </div>
                    ) : (
                      <span className="users-muted">{isSelf ? "——" : "无权限"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
