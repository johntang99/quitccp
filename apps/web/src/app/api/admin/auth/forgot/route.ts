import { NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

/**
 * Send a password-reset link.
 *
 * The answer is the same whether or not the address has an account. Telling a
 * stranger "no such user" turns this form into a way to discover who works here,
 * which for this organisation is not an abstract concern.
 *
 * Supabase owns the token: it is single-use, short-lived, and never stored by
 * us, which is why there is no reset-token table in this codebase.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const origin = new URL(request.url).origin;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    try {
      const supabase = await createSupabaseAuthClient();
      // No query string on purpose: the email template appends
      // `?token_hash=…&type=recovery`, and a redirectTo that already carried a
      // `?` would force the template to guess between `?` and `&`. The callback
      // defaults `next` to /admin/reset, so nothing is lost.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/api/admin/auth/callback`
      });
    } catch {
      // Swallowed on purpose: a provider outage must not become a probe that
      // distinguishes real addresses from invented ones.
    }
  }

  return NextResponse.redirect(new URL("/admin/forgot?sent=1", request.url), 303);
}
