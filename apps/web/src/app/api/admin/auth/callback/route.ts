import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

/**
 * Where an emailed link lands.
 *
 * Two shapes are accepted, and the first is the one that matters:
 *
 *  - `token_hash` + `type`, verified with `verifyOtp`. This is what Supabase
 *    documents for server-rendered apps, and the only shape that survives the
 *    link being opened somewhere other than the browser that asked for it --
 *    which is the normal case, because people read mail in a mail app.
 *  - `code`, exchanged with `exchangeCodeForSession`. The PKCE flow, kept as a
 *    fallback. It only works in the same browser, because the verifier lives in
 *    a cookie there.
 *
 * The first requires the "Reset password" email template to send
 * `{{ .TokenHash }}`; see docs/implementation/user-management-plan.md. Until it
 * does, Supabase sends the default link and only the fallback applies.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/admin/reset";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const failed = () =>
    NextResponse.redirect(new URL("/admin/forgot?error=link", request.url), 303);

  try {
    const supabase = await createSupabaseAuthClient();

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      return error ? failed() : NextResponse.redirect(new URL(next, request.url), 303);
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return error ? failed() : NextResponse.redirect(new URL(next, request.url), 303);
    }
  } catch {
    return failed();
  }

  // Expired, already used, tampered with, or opened without a token -- all the
  // same to the visitor, who is told to request a fresh link.
  return failed();
}
