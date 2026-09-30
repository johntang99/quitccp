import type { AdminUser } from "@/lib/admin/types";
import { AdminNav } from "./AdminNav";

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
        <AdminNav />
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
