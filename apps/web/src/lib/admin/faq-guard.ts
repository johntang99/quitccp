import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import type { AdminUser } from "@/lib/admin/types";

/**
 * The checks every writing FAQ route makes, in one place.
 *
 * Deliberately not exported from a `route.ts`: Next.js only allows HTTP method
 * exports there, and a stray helper export fails the production build with a
 * type error rather than at the point of use.
 */
export async function guardFaqWrite(): Promise<
  { user: AdminUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getAdminSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!adminCanWrite(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  try {
    requireAdminMfa(user);
  } catch {
    return { error: NextResponse.json({ error: "需要通过两步验证后才能保存。" }, { status: 403 }) };
  }
  return { user };
}
