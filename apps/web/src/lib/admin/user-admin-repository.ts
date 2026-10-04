import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import type { AdminRole } from "./types";

/**
 * The user-management screens.
 *
 * Two stores are kept in step: Supabase Auth holds the credential, and
 * `cms_admin_users` holds the role. They are joined on email -- there is no id
 * shared between them -- so every write here has to consider both, and the order
 * matters. See `createAdminUser` for why the auth user is made first.
 */

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  lastLoginAt: string | null;
  /** False when the row has no matching Supabase identity -- it cannot sign in. */
  hasAuthIdentity: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `密码至少 ${MIN_PASSWORD_LENGTH} 位。`;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确。";
  return null;
}

async function authIdByEmail(email: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  // listUsers has no email filter; the staff table is small enough that one page
  // covers it, and this keeps us off an undocumented admin endpoint.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const match = (data.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
  );
  return match?.id ?? null;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_admin_users")
    .select("id, email, name, role, is_active, created_by, created_at, last_login_at")
    .order("role", { ascending: true })
    .order("email", { ascending: true });
  if (error) throw error;

  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authEmails = new Set(
    (authList?.users ?? []).map((u) => (u.email ?? "").toLowerCase())
  );

  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : "",
    role: row.role as AdminRole,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by ? String(row.created_by) : "",
    createdAt: String(row.created_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    hasAuthIdentity: authEmails.has(String(row.email).toLowerCase())
  }));
}

export async function findManagedUserById(id: string): Promise<ManagedUser | null> {
  const all = await listManagedUsers();
  return all.find((u) => u.id === id) ?? null;
}

/**
 * Creates both halves of an account.
 *
 * The Supabase identity goes first: if it fails -- duplicate address, password
 * refused by a policy -- nothing has been written, and the caller sees the real
 * reason. Creating the role row first would leave an account that appears in the
 * list and cannot sign in.
 */
export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  role: AdminRole;
  actorEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("cms_admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: false, error: "这个邮箱已经有账号了。" };

  const { error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true
  });
  if (authError) return { ok: false, error: authError.message };

  const { error } = await supabase.from("cms_admin_users").insert({
    email,
    name: input.name.trim() || null,
    role: input.role,
    is_active: true,
    // Supabase owns the credential now; 018 made these nullable.
    password_hash: null,
    password_salt: null,
    mfa_enabled: false,
    created_by: input.actorEmail
  });
  if (error) {
    // Roll the identity back so a failure here cannot leave an account that can
    // sign in but has no role.
    const id = await authIdByEmail(email);
    if (id) await supabase.auth.admin.deleteUser(id);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateAdminUser(
  id: string,
  patch: { name?: string; role?: AdminRole; isActive?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim() || null;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await supabase.from("cms_admin_users").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sets someone else's password. Theirs is replaced, never revealed. */
export async function setUserPassword(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient();
  const id = await authIdByEmail(email);
  if (!id) return { ok: false, error: "这个账号还没有登录身份，无法设置密码。" };
  const { error } = await supabase.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAdminUser(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("cms_admin_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "账号不存在。" };

  const authId = await authIdByEmail(String(row.email));
  if (authId) await supabase.auth.admin.deleteUser(authId);
  const { error } = await supabase.from("cms_admin_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** How many super admins are still able to sign in. */
export async function countActiveSuperAdmins(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("cms_admin_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

/**
 * email -> display name, for the 创建人 columns.
 *
 * Content rows store an email because that is what survives an account being
 * renamed or deleted; the lists want a person's name. Looked up once per request
 * (`cache`) and shared by every table on the page -- the staff table is tiny, so
 * this is one small query, not one per row.
 *
 * Never throws: a column that cannot resolve a name falls back to the email, and
 * a failure here must not take down the article list.
 */
export const listAdminDisplayNames = cache(async (): Promise<Record<string, string>> => {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("cms_admin_users").select("email, name");
    if (error) throw error;
    const out: Record<string, string> = {};
    for (const row of data ?? []) {
      const email = String(row.email ?? "").toLowerCase();
      const name = row.name ? String(row.name).trim() : "";
      if (email && name) out[email] = name;
    }
    return out;
  } catch {
    return {};
  }
});

/**
 * How an actor is shown in a list: their name, else the part of the email before
 * the @, else a dash. The full email stays available as a title attribute at the
 * call site, so the exact account is still recoverable.
 */
export function actorLabel(email: string, names: Record<string, string>): string {
  const key = (email ?? "").trim().toLowerCase();
  if (!key) return "—";
  return names[key] ?? key.split("@")[0];
}
