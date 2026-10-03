import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

export default async function AdminForgotPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="admin-auth">
      <h1>找回密码</h1>
      {params.sent ? (
        <p className="users-ok">
          如果这个邮箱有账号，重设密码的链接已经发出。请查收邮件（也看一下垃圾邮件）。
          链接有效期较短，用过一次就失效。
        </p>
      ) : null}
      {params.error === "link" ? (
        <p className="users-error">这个链接已经失效或已被使用，请重新申请一次。</p>
      ) : null}
      <form method="post" action="/api/admin/auth/forgot" style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span>邮箱</span>
          <input className="admin-input" name="email" type="email" required />
        </label>
        <button className="admin-btn admin-btn-primary" type="submit">发送重设链接</button>
      </form>
      <p style={{ color: "#555", fontSize: 13 }}>
        <Link href="/admin/login">返回登录</Link>
      </p>
    </main>
  );
}
