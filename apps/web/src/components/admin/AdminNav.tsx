"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can } from "@/lib/admin/permissions";
import { ADMIN_NAV_LINKS } from "@/lib/admin/permission-matrix";
import type { AdminRole } from "@/lib/admin/types";

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
  const visible = ADMIN_NAV_LINKS.filter((link) => !link.needs || can({ role }, link.needs));
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (link: { href: string; owns?: readonly string[] }) =>
    matches(link.href) || (link.owns ?? []).some(matches);

  return (
    <nav>
      {visible.map((link) =>
        link.chrome ? (
          /* Signing out is a state change, so it posts. As a <Link> it was
             prefetched by the production build and logged people out without a
             click -- see the route handler for the full story. */
          <form key={link.href} method="post" action="/api/admin/auth/logout">
            <button type="submit">{link.label}</button>
          </form>
        ) : (
          <Link key={link.href} href={link.href} className={isActive(link) ? "on" : undefined}>
            {link.label}
          </Link>
        )
      )}
    </nav>
  );
}
