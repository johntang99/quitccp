import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { hashPassword } from "@/lib/security/password";
import type { AdminRole } from "./types";

const LOCKOUT_MINUTES = 15;
const MAX_FAILURES = 5;

export interface AdminUserRow {
  id: string;
  email: string;
  role: AdminRole;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  passwordHash: string;
  passwordSalt: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

function defaultSeedRole(raw: string | undefined): AdminRole {
  const role = (raw ?? "super_admin") as AdminRole;
  const allowed: AdminRole[] = ["super_admin", "content_admin", "editor", "reviewer", "viewer"];
  return allowed.includes(role) ? role : "super_admin";
}

function mapRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: String(row.id),
    email: String(row.email),
    role: row.role as AdminRole,
    mfaEnabled: Boolean(row.mfa_enabled),
    mfaSecret: row.mfa_secret ? String(row.mfa_secret) : null,
    passwordHash: row.password_hash ? String(row.password_hash) : "",
    passwordSalt: row.password_salt ? String(row.password_salt) : "",
    isActive: Boolean(row.is_active),
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    lockedUntil: row.locked_until ? String(row.locked_until) : null
  };
}

export async function ensureSeedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: queryError } = await supabase
    .from("cms_admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (queryError) throw queryError;
  if (existing) return;

  const { hash, salt } = hashPassword(password);
  const mfaSecret = process.env.SEED_ADMIN_MFA_SECRET?.trim() || null;
  const { error: insertError } = await supabase.from("cms_admin_users").insert({
    email,
    role: defaultSeedRole(process.env.SEED_ADMIN_ROLE),
    password_hash: hash,
    password_salt: salt,
    mfa_enabled: true,
    mfa_secret: mfaSecret
  });
  if (insertError) throw insertError;
}

export async function findAdminUserByEmail(email: string): Promise<AdminUserRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_admin_users")
    .select(
      "id, email, role, mfa_enabled, mfa_secret, password_hash, password_salt, is_active, failed_login_attempts, locked_until"
    )
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function findAdminUserById(id: string): Promise<AdminUserRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_admin_users")
    .select(
      "id, email, role, mfa_enabled, mfa_secret, password_hash, password_salt, is_active, failed_login_attempts, locked_until"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export function isAccountLocked(user: AdminUserRow): boolean {
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function recordAdminLoginFailure(user: AdminUserRow) {
  const supabase = createSupabaseAdminClient();
  const failures = user.failedLoginAttempts + 1;
  const shouldLock = failures >= MAX_FAILURES;
  const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;
  const { error } = await supabase
    .from("cms_admin_users")
    .update({
      failed_login_attempts: failures,
      locked_until: lockedUntil
    })
    .eq("id", user.id);
  if (error) throw error;
}

export async function recordAdminLoginSuccess(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cms_admin_users")
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString()
    })
    .eq("id", userId);
  if (error) throw error;
}
