import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthCookieName } from "@/lib/admin/auth";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

/**
 * Signing out is a POST, and deliberately not a GET.
 *
 * It used to be a GET reached through a `<Link href="/admin/logout">` in the
 * sidebar. Next.js prefetches links in production builds, so merely rendering
 * the sidebar fired the prefetch, the prefetch ran this handler, and the
 * session was destroyed before the reader clicked anything -- the next page
 * they opened bounced them to the login screen. Development never prefetches,
 * which is why it only happened in production.
 *
 * A GET must be safe to repeat and safe to perform speculatively; destroying a
 * session is neither. With only POST exported, no prefetch, crawler or preload
 * can sign anyone out.
 */
export async function POST() {
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
