import { AdminShell } from "@/components/admin/AdminShell";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { loadTheme } from "@/lib/public-theme";

export default async function AdminThemePage() {
  const user = await requireAdminSessionUser();
  const theme = await loadTheme();

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>主题与排版</h2>
        <p>
          控制全站的颜色、字体、字号、行距与间距。右侧为实时预览，保存后立即对所有访客生效；
          「恢复默认」会删除自定义设置，回到随代码发布的那一套。
        </p>
      </section>
      <ThemeEditor initial={theme} />
    </AdminShell>
  );
}
