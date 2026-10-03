import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { listSettings } from "@/lib/admin/repository";

interface AdminSettingsPageProps {
  searchParams: Promise<{ searchSync?: string; indexed?: string; index?: string; message?: string }>;
}

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  const user = await requireAdminSessionUser();
  if (!can(user, "settings.write")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>站点设置</h2>
          <p>你的账号没有权限打开这个页面。需要管理员或超级管理员权限。</p>
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
        <h2 style={{ marginTop: 0 }}>站点设置</h2>
        <p>用于维护 header/footer/nav/SEO 等全局 JSON 配置。</p>
        {searchSyncState === "ok" ? (
          <p style={{ color: "#0f766e", marginTop: 8 }}>
            搜索索引同步成功：index={searchSyncIndex || "articles"}，写入 {searchSyncIndexed || "0"} 条记录。
          </p>
        ) : null}
        {searchSyncState === "error" ? (
          <p style={{ color: "#b91c1c", marginTop: 8 }}>搜索索引同步失败：{searchSyncMessage || "unknown_error"}</p>
        ) : null}
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>值</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>暂无设置</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.settingKey}</td>
                  <td>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{row.valueJson}</pre>
                  </td>
                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>新增/更新设置</h3>
        <form method="post" action="/api/admin/content/settings" style={{ display: "grid", gap: 10 }}>
          <input className="admin-input" name="id" placeholder="id (可留空自动生成)" />
          <input className="admin-input" name="settingKey" placeholder="site.header / site.nav / seo.default" required />
          <textarea className="admin-textarea" name="valueJson" defaultValue={"{}"} />
          <button className="admin-btn admin-btn-primary" type="submit">
            保存设置
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>搜索索引（Meilisearch）</h3>
        <p style={{ marginTop: 0 }}>
          手动触发一次索引同步。需要已配置 <code>MEILI_HOST</code> 与对应密钥环境变量。
        </p>
        <form method="post" action="/api/admin/content/search/sync" style={{ display: "grid", gap: 10 }}>
          <input className="admin-input" name="locales" defaultValue="zh" placeholder="zh 或 zh,en" />
          <input className="admin-input" name="batchSize" defaultValue="200" placeholder="每批大小（建议 100-500）" />
          <button className="admin-btn admin-btn-primary" type="submit">
            立即同步搜索索引
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
