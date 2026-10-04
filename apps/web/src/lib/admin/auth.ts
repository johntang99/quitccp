import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, signJwt } from "@/lib/security/jwt";
import { isMfaRequired } from "@/lib/security/mfa-policy";
import { getAdminJwtSecret } from "@/lib/supabase/admin-client";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { findAdminUserByEmail, findAdminUserById } from "./user-repository";
import { can } from "./permissions";
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

/**
 * Who is signed in.
 *
 * Reads two sessions during the migration to Supabase Auth: the Supabase one
 * first, then the legacy signed cookie. Both are accepted so the cut-over needs
 * no flag day -- anyone already signed in keeps their session, and new sign-ins
 * get a Supabase one. The legacy branch comes out once every account has moved.
 *
 * Authentication comes from Supabase; *authorisation* still comes from
 * `cms_admin_users`, matched on email. That table stays the record of who may do
 * what, which is why a Supabase user with no row there is refused.
 */
export async function getAdminSessionUser(): Promise<AdminUser | null> {
  return (await getSupabaseSessionUser()) ?? (await getLegacySessionUser());
}

async function getSupabaseSessionUser(): Promise<AdminUser | null> {
  let email: string | null = null;
  try {
    const supabase = await createSupabaseAuthClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    email = data.user.email;
  } catch {
    // Misconfigured env, or no Supabase session on this request.
    return null;
  }

  let dbUser = null;
  try {
    dbUser = await findAdminUserByEmail(email);
  } catch {
    return null;
  }
  if (!dbUser || !dbUser.isActive) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    mfaEnabled: dbUser.mfaEnabled,
    // Supabase tracks this as an assurance level, which Phase 6 will read when
    // MFA is switched on. Until then this stays false: `requireAdminMfa()`
    // ignores it while MFA is off, and if MFA were turned on before Phase 6 the
    // effect is to deny writes rather than wave them through.
    mfaVerified: false
  };
}

async function getLegacySessionUser(): Promise<AdminUser | null> {
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

/**
 * May this user set content to 已发布 or 已归档?
 *
 * Delegates to the capability table rather than testing roles here, so the
 * permission matrix shown in 用户管理 and this check can never disagree. The name
 * is historical -- it gates single saves as well as bulk actions.
 */
export function canBulkPublish(user: AdminUser): boolean {
  return can(user, "content.publish");
}

export function canReviewArticles(user: AdminUser): boolean {
  return user.role === "super_admin" || user.role === "content_admin" || user.role === "reviewer";
}

/** Delegates to the capability table so this and the matrix cannot disagree. */
export function canRestoreRevisions(user: AdminUser): boolean {
  return can(user, "revisions.restore");
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
