import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import type { AdminUser } from "@/lib/admin/types";

/**
 * The checks every material write shares.
 *
 * Lives here rather than in a route file because a Next.js route module may
 * export only HTTP method handlers -- exporting a helper from one breaks the
 * build, which is how the FAQ guard ended up in its own file too.
 */
export async function guardMaterialWrite(): Promise<{ user: AdminUser | null; error: NextResponse | null }> {
  const user = await getAdminSessionUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!adminCanWrite(user)) return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  requireAdminMfa(user);
  return { user, error: null };
}
