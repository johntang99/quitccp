import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthCookieName } from "@/lib/admin/auth";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function GET() {
  // Both sessions are cleared, not just the one this account happens to use:
  // during the migration a browser can hold either, and signing out has to mean
  // signed out.
  try {
    const supabase = await createSupabaseAuthClient();
    await supabase.auth.signOut();
  } catch {
    // No Supabase session, or env missing -- the legacy cookie below still goes.
  }
  const cookieStore = await cookies();
  cookieStore.delete(adminAuthCookieName);
  redirect("/admin/login");
}
