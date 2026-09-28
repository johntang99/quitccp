import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, signJwt } from "@/lib/security/jwt";
import { isMfaRequired } from "@/lib/security/mfa-policy";
import { getAdminJwtSecret } from "@/lib/supabase/admin-client";
import { findAdminUserById } from "./user-repository";
import type { AdminRole, AdminUser } from "./types";

const SESSION_COOKIE = "quitccp_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

interface AdminSessionClaims {
  sub: string;
  email: string;
  role: AdminRole;
  mfa: boolean;
  scope: "admin";
  exp: number;
  iat: number;
}

export async function getAdminSessionUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = verifyJwt<AdminSessionClaims>(token, getAdminJwtSecret());
  if (!claims || claims.scope !== "admin") return null;

  let dbUser = null;
  try {
    dbUser = await findAdminUserById(claims.sub);
  } catch {
    return null;
  }
  if (!dbUser || !dbUser.isActive) return null;
  if (dbUser.email !== claims.email || dbUser.role !== claims.role) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    mfaEnabled: dbUser.mfaEnabled,
    mfaVerified: claims.mfa && dbUser.mfaEnabled
  };
}

export async function requireAdminSessionUser(): Promise<AdminUser> {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

export function assertAdminRole(user: AdminUser, roles: AdminRole[]) {
  if (!roles.includes(user.role)) throw new Error("Permission denied");
}

export function adminCanWrite(user: AdminUser): boolean {
  return user.role === "super_admin" || user.role === "content_admin" || user.role === "editor";
}

export function requireAdminMfa(user: AdminUser) {
  if (!isMfaRequired()) return;
  if (!user.mfaEnabled || !user.mfaVerified) throw new Error("MFA required");
}

export const adminAuthCookieName = SESSION_COOKIE;

export function issueAdminSessionToken(user: Pick<AdminUser, "id" | "email" | "role">, mfaVerified: boolean) {
  return signJwt<{
    sub: string;
    email: string;
    role: AdminRole;
    mfa: boolean;
    scope: "admin";
  }>(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      mfa: mfaVerified,
      scope: "admin"
    },
    getAdminJwtSecret(),
    SESSION_TTL_SECONDS
  );
}

export function canBulkPublish(user: AdminUser): boolean {
  return user.role === "super_admin" || user.role === "content_admin";
}

export function canReviewArticles(user: AdminUser): boolean {
  return user.role === "super_admin" || user.role === "content_admin" || user.role === "reviewer";
}

export function canRestoreRevisions(user: AdminUser): boolean {
  return user.role === "super_admin" || user.role === "content_admin";
}

/**
 * Declarations are service-domain data, not content. A statement can identify
 * someone who is still inside mainland China, so the content roles -- editor,
 * reviewer, viewer -- have no business reading the queue at all.
 *
 * Deliberately the narrowest default: widening this is a one-line change,
 * whereas a leak is not recoverable. The longer-term answer is a dedicated
 * service-operator admin role rather than reusing the content role ladder;
 * that needs a migration and user-management work.
 */
export function canAccessDeclarations(user: AdminUser): boolean {
  return user.role === "super_admin";
}
