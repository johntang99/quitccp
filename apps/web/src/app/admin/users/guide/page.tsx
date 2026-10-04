import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { PermissionTables } from "@/components/admin/PermissionTables";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { OWNER_EMAIL, can } from "@/lib/admin/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/user-admin-repository";

/**
 * 用户管理说明 — the manual for the people who run the CMS.
 *
 * Kept inside the admin rather than in docs/: the Vercel project's root is
 * apps/web, so nothing outside it exists at runtime, and a document coworkers
 * cannot open from the screen they are using is a document nobody reads. The
 * tables are generated from the permission code, so this page cannot go stale in
 * the way a written-out matrix does.
 */
export default async function UserGuidePage() {
  const user = await requireAdminSessionUser();
  // Same gate as 用户管理 itself: editors are not shown the staff manual.
  if (!can(user, "users.view")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>用户管理说明</h2>
          <p>你的账号没有权限打开这个页面。需要管理员或超级管理员权限。</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>用户管理说明</h2>
          <Link href="/admin/users" className="admin-btn admin-btn-sm">← 返回用户管理</Link>
        </div>
        <p style={{ color: "#5a6072" }}>
          这份说明讲三件事：账号分成哪几种、各自能做什么、以及怎么处理常见情况。
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>一、三种角色</h3>
        <dl style={{ lineHeight: 1.9, margin: 0 }}>
          <dt><strong>编辑</strong></dt>
          <dd style={{ marginLeft: 0, marginBottom: 14, color: "#5a6072" }}>
            网站内容的主力。凡是跟内容有关的都归编辑：文章、视频、资料的新建、修改、
            发布与归档，分类管理，页面内容（含首页头图），媒体资源，修订历史（回退到旧版本），
            查看三退声明，点「立即发布」。
            不能改主题与排版，不能改站点设置，看不到用户管理与审计日志。
          </dd>
          <dt><strong>管理员</strong></dt>
          <dd style={{ marginLeft: 0, marginBottom: 14, color: "#5a6072" }}>
            编辑能做的都能做，另外可以改主题与排版、站点设置，可以查看审计日志。
            在用户管理里可以新建编辑、停用编辑、重设编辑的密码、删除编辑；
            但不能新建管理员，也不能修改或删除其他管理员——那需要超级管理员。
          </dd>
          <dt><strong>超级管理员</strong></dt>
          <dd style={{ marginLeft: 0, marginBottom: 14, color: "#5a6072" }}>
            可以做任何事，包括新建管理员和其他超级管理员。
            唯一的例外是：超级管理员之间不能互相修改或删除，这件事只有所有者账号可以做。
          </dd>
          <dt><strong>所有者</strong>（{OWNER_EMAIL}）</dt>
          <dd style={{ marginLeft: 0, color: "#5a6072" }}>
            不是第四种角色，而是一个特定的超级管理员账号。
            它是唯一能修改或删除其他超级管理员的账号。这样即使某个超级管理员账号被盗，
            对方也无法把其他管理者一次性清空。
          </dd>
        </dl>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>二、权限对照表</h3>
        <PermissionTables />
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>三、怎么做</h3>

        <h4>新建一个账号</h4>
        <p style={{ color: "#5a6072" }}>
          在 <Link href="/admin/users">用户管理</Link> 的「添加用户」里填姓名、邮箱、密码、角色。
          密码至少 {MIN_PASSWORD_LENGTH} 位。保存后请把密码当面或通过安全渠道告诉本人，
          并请对方登录后到「我的账号」自行修改——系统里没有任何人能再看到这个密码。
          「角色」下拉框只会列出你有权授予的角色。
        </p>

        <h4>某人忘记密码</h4>
        <p style={{ color: "#5a6072" }}>
          让本人在登录页点「忘记密码」，输入邮箱，系统会发一封重设邮件，有效期较短。
          这是推荐做法，因为全程不经过第三个人的手。
          如果对方收不到邮件，管理员也可以在用户管理里直接为其设置一个新密码。
        </p>

        <h4>某人离开团队</h4>
        <p style={{ color: "#5a6072" }}>
          优先用「停用」而不是「删除」。停用后该账号立刻无法登录，但审计日志里的记录仍然
          指向一个真实的账号，查起来是清楚的。确实需要彻底清除时再用「删除」。
        </p>

        <h4>改密码之后会怎样</h4>
        <p style={{ color: "#5a6072" }}>
          本人在「我的账号」改密码时，需要先输入当前密码——光有一个已登录的浏览器不算证明身份。
          改完之后，该账号在其他设备上的登录会被全部退出。
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>四、安全上的几点说明</h3>
        <ul style={{ color: "#5a6072", lineHeight: 1.9, margin: 0, paddingLeft: 20 }}>
          <li>
            登录与密码由 Supabase Auth 负责，本系统只保存「这个邮箱是什么角色」。
            密码以不可逆的方式存放，任何管理员、任何页面都读不出来。
          </li>
          <li>
            界面上看不到的按钮，服务器同样会拒绝。隐藏按钮只是为了不让人走进死路，
            真正的检查在服务器端，直接调接口也绕不过去。
          </li>
          <li>
            用户管理里的每一次新建、改角色、停用、重设密码、删除都会写入
            <Link href="/admin/audit"> 审计日志</Link>，记录谁在什么时候对谁做了什么。密码本身不会被记录。
          </li>
          <li>
            多重验证（MFA）目前没有启用，等需要时再开。
          </li>
        </ul>
      </section>
    </AdminShell>
  );
}
