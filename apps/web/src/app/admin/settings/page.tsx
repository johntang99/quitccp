import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { listSettings } from "@/lib/admin/repository";
import { SITE_LOCALE } from "@/lib/site-config";
import { formatDateTime } from "@/lib/format";

interface AdminSettingsPageProps {
  searchParams: Promise<{ searchSync?: string; indexed?: string; index?: string; message?: string }>;
}

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  const user = await requireAdminSessionUser();
  if (!can(user, "settings.write")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{t("admin.settings.title")}</h2>
          <p>{t("admin.users.noPermission")}</p>
        </section>
      </AdminShell>
    );
  }
  const rows = await listSettings(user.email);
  const params = await searchParams;
  const searchSyncState = params.searchSync ?? "";
  const searchSyncIndexed = params.indexed ?? "";
  const searchSyncIndex = params.index ?? "";
  const searchSyncMessage = params.message ?? "";

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.settings.title")}</h2>
        <p>{t("admin.settings.intro")}</p>
        {searchSyncState === "ok" ? (
          <p style={{ color: "#0f766e", marginTop: 8 }}>
            {t("admin.settings.syncOk", { index: searchSyncIndex || "articles", n: searchSyncIndexed || "0" })}
          </p>
        ) : null}
        {searchSyncState === "error" ? (
          <p style={{ color: "#b91c1c", marginTop: 8 }}>{t("admin.settings.syncFailed", { error: searchSyncMessage || "unknown_error" })}</p>
        ) : null}
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>{t("admin.settings.col.value")}</th>
              <th>{t("admin.settings.col.updated")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>{t("admin.settings.empty")}</td>
              </tr>
            ) : (
              rows.map((row) => (
                /* 设置项的值是数据：里面有自检结果，每小时一变。 */
                <tr key={row.id} data-snapshot="data">
                  <td>{row.settingKey}</td>
                  <td>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{row.valueJson}</pre>
                  </td>
                  <td>{formatDateTime(row.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.settings.upsertTitle")}</h3>
        <form method="post" action="/api/admin/content/settings" style={{ display: "grid", gap: 10 }}>
          <input className="admin-input" name="id" placeholder={t("admin.settings.idPlaceholder")} />
          <input className="admin-input" name="settingKey" placeholder="site.header / site.nav / seo.default" required />
          <textarea className="admin-textarea" name="valueJson" defaultValue={"{}"} />
          <button className="admin-btn admin-btn-primary" type="submit">
            {t("admin.settings.save")}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.settings.searchTitle")}</h3>
        <p style={{ marginTop: 0 }}>
          {tRich("admin.settings.searchNote", { host: <code>MEILI_HOST</code> })}
        </p>
        <form method="post" action="/api/admin/content/search/sync" style={{ display: "grid", gap: 10 }}>
          <input className="admin-input" name="locales" defaultValue={SITE_LOCALE} placeholder={t("admin.settings.localesPlaceholder")} />
          <input className="admin-input" name="batchSize" defaultValue="200" placeholder={t("admin.settings.batchPlaceholder")} />
          <button className="admin-btn admin-btn-primary" type="submit">
            {t("admin.settings.syncNow")}
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
