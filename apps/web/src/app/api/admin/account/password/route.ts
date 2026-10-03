import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/repository";
import { validatePassword } from "@/lib/admin/user-admin-repository";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

function back(request: Request, error?: string) {
  const url = new URL("/admin/account", request.url);
  if (error) url.searchParams.set("error", error);
  else url.searchParams.set("ok", "1");
  return NextResponse.redirect(url, 303);
}

/**
 * Change your own password.
 *
 * The current password is re-checked even though the caller is already signed
 * in. A session cookie proves someone signed in at some point; it does not prove
 * the person at the keyboard now is the account's owner. Without this, an
 * unattended logged-in browser is a permanent account takeover.
 */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (next !== confirm) return back(request, "两次输入的新密码不一致。");
  const invalid = validatePassword(next);
  if (invalid) return back(request, invalid);
  if (next === current) return back(request, "新密码不能和当前密码相同。");

  const supabase = await createSupabaseAuthClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current
  });
  if (reauthError) return back(request, "当前密码不正确。");

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return back(request, error.message);

  // Everywhere else this account is signed in is dropped: if the old password
  // leaked, changing it has to end the sessions it opened.
  await supabase.auth.signOut({ scope: "others" });

  await recordAdminAudit(user.email, "account.password", "admin_user", user.email, "write");
  return back(request);
}
