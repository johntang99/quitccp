"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { href: "/admin/theme", label: "主题与排版" },
  { href: "/admin/settings", label: "站点设置" },
  { href: "/admin/audit", label: "审计日志" },
  { href: "/admin/revisions", label: "修订历史" },
  { href: "/admin/logout", label: "退出" }
] as const;

/**
 * The sidebar, with the current section marked.
 *
 * Matching is exact or on a path segment boundary, never a bare prefix:
 * /admin/video-categories must not light 视频管理 just because /admin/videos
 * shares its first characters, while /admin/videos/<id> must.
 */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (link: { href: string; owns?: readonly string[] }) =>
    matches(link.href) || (link.owns ?? []).some(matches);

  return (
    <nav>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={isActive(link) ? "on" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
