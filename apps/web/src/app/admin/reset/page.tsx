import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/user-admin-repository";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

/**
 * Set a new password, reached only from the emailed link.
 *
 * The callback route has already exchanged the one-time code for a session, so
 * "is this person allowed to set this password" is answered by whether that
 * session exists -- not by a token in the URL that could be replayed.
 */
export default async function AdminResetPage({ searchParams }: PageProps) {
  const params = await searchParams;
  let email: string | null = null;
  try {
    const supabase = await createSupabaseAuthClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    email = null;
  }

  if (!email) {
    return (
      <main className="admin-auth">
        <h1>设置新密码</h1>
        <p className="users-error">
          这个页面需要从邮件里的链接打开。链接可能已经失效，或者已经用过了。
        </p>
        <p style={{ fontSize: 13 }}>
          <Link href="/admin/forgot">重新申请一个链接</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="admin-auth">
      <h1>设置新密码</h1>
      <p style={{ color: "#555", fontSize: 13 }}>账号：{email}</p>
      {params.error ? <p className="users-error">{decodeURIComponent(params.error)}</p> : null}
      <form method="post" action="/api/admin/auth/reset" style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span>新密码（至少 {MIN_PASSWORD_LENGTH} 位）</span>
          <input className="admin-input" name="newPassword" type="password"
                 minLength={MIN_PASSWORD_LENGTH} required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span>再输入一次</span>
          <input className="admin-input" name="confirmPassword" type="password"
                 minLength={MIN_PASSWORD_LENGTH} required />
        </label>
        <button className="admin-btn admin-btn-primary" type="submit">保存并登录</button>
      </form>
    </main>
  );
}
