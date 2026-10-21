import Link from "next/link";
import { t } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

export default async function AdminForgotPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="admin-auth">
      <h1>{t("admin.forgot.title")}</h1>
      {params.sent ? (
        <p className="users-ok">{t("admin.forgot.sent")}</p>
      ) : null}
      {params.error === "link" ? (
        <p className="users-error">{t("admin.forgot.badLink")}</p>
      ) : null}
      <form method="post" action="/api/admin/auth/forgot" style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span>{t("admin.login.email")}</span>
          <input className="admin-input" name="email" type="email" required />
        </label>
        <button className="admin-btn admin-btn-primary" type="submit">{t("admin.forgot.submit")}</button>
      </form>
      <p style={{ color: "#555", fontSize: 13 }}>
        <Link href="/admin/login">{t("admin.forgot.backToLogin")}</Link>
      </p>
    </main>
  );
}
