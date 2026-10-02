"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/content", label: "页面内容" },
  { href: "/admin/declarations", label: "三退声明" },
  { href: "/admin/articles", label: "文章管理" },
  { href: "/admin/categories", label: "文章分类" },
  { href: "/admin/videos", label: "视频管理" },
  { href: "/admin/video-categories", label: "视频分类" },
  { href: "/admin/materials", label: "资料管理" },
  { href: "/admin/material-categories", label: "资料分类" },
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
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={isActive(link.href) ? "on" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
