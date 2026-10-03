"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Capability } from "@/lib/admin/permissions";
import type { AdminRole } from "@/lib/admin/types";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/content", label: "页面内容" },
  { href: "/admin/declarations", label: "三退声明" },
  // 文章分类 lives in the article tab bar now; the sidebar still lights up for
  // it, so the reader is never on a page no section claims.
  { href: "/admin/articles", label: "文章管理", owns: ["/admin/categories"] },
  { href: "/admin/videos", label: "视频管理", owns: ["/admin/video-categories"] },
  { href: "/admin/materials", label: "资料管理", owns: ["/admin/material-categories"] },
  { href: "/admin/media", label: "媒体资源" },
  { href: "/admin/theme", label: "主题与排版", needs: "theme.write" },
  { href: "/admin/settings", label: "站点设置", needs: "settings.write" },
  { href: "/admin/users", label: "用户管理", needs: "users.view" },
  { href: "/admin/audit", label: "审计日志", needs: "audit.read" },
  { href: "/admin/revisions", label: "修订历史", needs: "revisions.restore" },
  { href: "/admin/account", label: "我的账号" },
  { href: "/admin/logout", label: "退出" }
] as const;

/**
 * The sidebar, with the current section marked.
 *
 * Matching is exact or on a path segment boundary, never a bare prefix:
 * /admin/video-categories must not light 视频管理 just because /admin/videos
 * shares its first characters, while /admin/videos/<id> must.
 */
/**
 * Entries the signed-in user cannot open are not rendered.
 *
 * The pages and routes refuse them anyway; hiding the link is so nobody is
 * invited to a dead end. The server check is the real one -- this is courtesy.
 */
export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname() ?? "";
  const visible = LINKS.filter((link) => !("needs" in link) || can({ role }, link.needs as Capability));
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (link: { href: string; owns?: readonly string[] }) =>
    matches(link.href) || (link.owns ?? []).some(matches);

  return (
    <nav>
      {visible.map((link) => (
        <Link key={link.href} href={link.href} className={isActive(link) ? "on" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
