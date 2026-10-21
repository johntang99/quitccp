import { AdminPasswordInput } from "@/components/admin/AdminPasswordInput";
import { isMfaRequired } from "@/lib/security/mfa-policy";
import { t } from "@/lib/i18n";

interface AdminLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

function getErrorMessage(code?: string) {
  if (code === "setup") return t("admin.login.error.setup");
  if (code === "locked") return t("admin.login.error.locked");
  if (code === "2") return t("admin.login.error.mfa");
  if (code === "1") return t("admin.login.error.credentials");
  return null;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const error = getErrorMessage(params.error);
  const mfaRequired = isMfaRequired();
  return (
    <main className="admin-login-wrap">
      <h1 style={{ marginTop: 0 }}>{t("admin.login.title")}</h1>
      {error ? (
        <p style={{ margin: "0 0 10px", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>{error}</p>
      ) : null}
      <form method="post" action="/api/admin/auth/login" style={{ display: "grid", gap: 12 }}>
        <label>
          {t("admin.login.email")}
          <input className="admin-input" name="email" defaultValue={process.env.SEED_ADMIN_EMAIL ?? ""} />
        </label>
        <AdminPasswordInput />
        {mfaRequired ? (
          <label>
            {t("admin.login.mfaCode")}
            <input className="admin-input" name="mfaCode" placeholder={t("admin.login.mfaPlaceholder")} />
          </label>
        ) : null}
        <button className="admin-btn admin-btn-primary" type="submit">
          {t("admin.login.submit")}
        </button>
      </form>
      <p style={{ color: "#555", fontSize: 13 }}>
        <a href="/admin/forgot">{t("admin.login.forgot")}</a>
      </p>
      {/* 两句完整的话，而不是一句话中间插一个变量：「支持 TOTP、」这种
          半截短语换成别的语言就拼不回一个句子。 */}
      <p style={{ color: "#555" }}>{t(mfaRequired ? "admin.login.noteMfa" : "admin.login.note")}</p>
    </main>
  );
}
