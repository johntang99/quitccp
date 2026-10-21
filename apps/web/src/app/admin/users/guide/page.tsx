import Link from "next/link";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
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
          <h2 style={{ marginTop: 0 }}>{t("admin.guide.title")}</h2>
          <p>{t("admin.users.noPermission")}</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>{t("admin.guide.title")}</h2>
          <Link href="/admin/users" className="admin-btn admin-btn-sm">{t("admin.guide.back")}</Link>
        </div>
        <p style={{ color: "#5a6072" }}>
          {t("admin.guide.intro")}
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.guide.rolesTitle")}</h3>
        <dl style={{ lineHeight: 1.9, margin: 0 }}>
          <dt><strong>{t("admin.guide.editor")}</strong></dt>
          <dd style={{ marginLeft: 0, marginBottom: 14, color: "#5a6072" }}>
            {t("admin.guide.editorBody")}
          </dd>
          <dt><strong>{t("admin.guide.admin")}</strong></dt>
          <dd style={{ marginLeft: 0, marginBottom: 14, color: "#5a6072" }}>
            {t("admin.guide.adminBody")}
          </dd>
          <dt><strong>{t("admin.guide.superAdmin")}</strong></dt>
          <dd style={{ marginLeft: 0, marginBottom: 14, color: "#5a6072" }}>
            {t("admin.guide.superAdminBody")}
          </dd>
          <dt><strong>{t("admin.guide.owner")}</strong>（{OWNER_EMAIL}）</dt>
          <dd style={{ marginLeft: 0, color: "#5a6072" }}>
            {t("admin.guide.ownerBody")}
          </dd>
        </dl>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.guide.tablesTitle")}</h3>
        <PermissionTables />
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.guide.howToTitle")}</h3>

        <h4>{t("admin.guide.createTitle")}</h4>
        <p style={{ color: "#5a6072" }}>
          {tRich("admin.guide.createBody", {
            link: <Link href="/admin/users">{t("admin.users.title")}</Link>,
            n: MIN_PASSWORD_LENGTH
          })}
        </p>

        <h4>{t("admin.guide.forgotTitle")}</h4>
        <p style={{ color: "#5a6072" }}>
          {t("admin.guide.forgotBody")}
        </p>

        <h4>{t("admin.guide.leaveTitle")}</h4>
        <p style={{ color: "#5a6072" }}>
          {t("admin.guide.leaveBody")}
        </p>

        <h4>{t("admin.guide.changePasswordTitle")}</h4>
        <p style={{ color: "#5a6072" }}>
          {t("admin.guide.changePasswordBody")}
        </p>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.guide.securityTitle")}</h3>
        <ul style={{ color: "#5a6072", lineHeight: 1.9, margin: 0, paddingLeft: 20 }}>
          <li>
            {t("admin.guide.security1")}
          </li>
          <li>
            {t("admin.guide.security2")}
          </li>
          <li>
            {tRich("admin.guide.security3", {
              link: <Link href="/admin/audit">{t("admin.guide.security3Link")}</Link>
            })}
          </li>
          <li>
            {t("admin.guide.security4")}
          </li>
        </ul>
      </section>
    </AdminShell>
  );
}
