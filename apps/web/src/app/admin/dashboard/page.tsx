import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listArticles, listAudits, listPages } from "@/lib/admin/repository";

export default async function AdminDashboardPage() {
  const user = await requireAdminSessionUser();
  const [pages, articles, audits] = await Promise.all([
    listPages(user.email),
    listArticles({ page: 1, pageSize: 20 }, user.email).then((res) => res.rows),
    listAudits(user.email)
  ]);

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>平台概览</h2>
        <div className="admin-toolbar">
          <span>页面：{pages.length}</span>
          <span>文章：{articles.length}</span>
          <span>审计记录：{audits.length}</span>
          <span>强制 MFA：已启用</span>
        </div>
      </section>
      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>当前实现边界</h3>
        <ul>
          <li>菜单“服务”页面和服务流程 API 在同一个 Next.js 应用内。</li>
          <li>页面与文章支持修订历史和审计记录。</li>
          <li>下一步可直接接入 Supabase 数据仓储层。</li>
        </ul>
      </section>
    </AdminShell>
  );
}
