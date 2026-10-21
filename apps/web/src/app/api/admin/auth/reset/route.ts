import { NextResponse } from "next/server";
import { t } from "@/lib/i18n";
import { recordAdminAudit } from "@/lib/admin/repository";
import { validatePassword } from "@/lib/admin/user-admin-repository";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const form = await request.formData();
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  const fail = (message: string) => {
    const url = new URL("/admin/reset", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  };

  if (next !== confirm) return fail(t("admin.reset.mismatch"));
  const invalid = validatePassword(next);
  if (invalid) return fail(invalid);

  const supabase = await createSupabaseAuthClient();
  // The recovery session from the emailed link is the only authority here.
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) {
    return NextResponse.redirect(new URL("/admin/forgot?error=link", request.url), 303);
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return fail(error.message);

  // Anyone holding a session opened with the forgotten password is dropped.
  await supabase.auth.signOut({ scope: "others" });
  await recordAdminAudit(email, "account.reset", "admin_user", email, "write");
  return NextResponse.redirect(new URL("/admin/dashboard", request.url), 303);
}
