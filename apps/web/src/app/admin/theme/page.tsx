import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { loadTheme } from "@/lib/public-theme";

export default async function AdminThemePage() {
  const user = await requireAdminSessionUser();
  if (!can(user, "theme.write")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("theme.title")}</h2>
          <p>{t("admin.users.noPermission")}</p>
        </section>
      </AdminShell>
    );
  }
  const theme = await loadTheme();

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("theme.title")}</h2>
        <p>
          {t("theme.intro")}
        </p>
      </section>
      <ThemeEditor initial={theme} />
    </AdminShell>
  );
}
