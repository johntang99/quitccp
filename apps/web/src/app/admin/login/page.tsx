import { AdminPasswordInput } from "@/components/admin/AdminPasswordInput";
import { isMfaRequired } from "@/lib/security/mfa-policy";

interface AdminLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

function getErrorMessage(code?: string) {
  if (code === "setup") return "认证表未就绪，请先执行最新 Supabase migrations。";
  if (code === "locked") return "账号已临时锁定，请稍后重试。";
  if (code === "2") return "MFA 验证失败。";
  if (code === "1") return "邮箱或密码错误。";
  return null;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const error = getErrorMessage(params.error);
  const mfaRequired = isMfaRequired();
  return (
    <main className="admin-login-wrap">
      <h1 style={{ marginTop: 0 }}>QuitCCP CMS 登录</h1>
      {error ? (
        <p style={{ margin: "0 0 10px", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>{error}</p>
      ) : null}
      <form method="post" action="/api/admin/auth/login" style={{ display: "grid", gap: 12 }}>
        <label>
          邮箱
          <input className="admin-input" name="email" defaultValue={process.env.SEED_ADMIN_EMAIL ?? ""} />
        </label>
        <AdminPasswordInput />
        {mfaRequired ? (
          <label>
            MFA 验证码
            <input className="admin-input" name="mfaCode" placeholder="6 位验证码" />
          </label>
        ) : null}
        <button className="admin-btn admin-btn-primary" type="submit">
          登录
        </button>
      </form>
      <p style={{ color: "#555", fontSize: 13 }}>
        <a href="/admin/forgot">忘记密码？</a>
      </p>
      <p style={{ color: "#555" }}>
        数据库账号登录，支持{mfaRequired ? " TOTP、" : " "}多次失败锁定与 JWT 会话。
      </p>
    </main>
  );
}
