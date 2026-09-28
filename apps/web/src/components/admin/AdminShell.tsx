import Link from "next/link";
import type { AdminUser } from "@/lib/admin/types";

interface AdminShellProps {
  user: AdminUser;
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h1>QuitCCP CMS</h1>
        <p className="admin-userline">
          {user.email} · {user.role}
        </p>
        <nav>
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/content">页面内容</Link>
          <Link href="/admin/declarations">三退声明</Link>
          <Link href="/admin/articles">文章管理</Link>
          <Link href="/admin/categories">分类管理</Link>
          <Link href="/admin/videos">视频管理</Link>
          <Link href="/admin/media">媒体资源</Link>
          <Link href="/admin/settings">站点设置</Link>
          <Link href="/admin/audit">审计日志</Link>
          <Link href="/admin/revisions">修订历史</Link>
          <Link href="/admin/logout">退出</Link>
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
