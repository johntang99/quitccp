import { createClient } from "@supabase/supabase-js";
import { mirrorRewrite, rewriteMediaText } from "@/lib/media-mirror";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export function getAdminJwtSecret() {
  return process.env.JWT_SECRET || requireEnv("JWT_SECRET");
}

/**
 * The same client, with media URLs rewritten to the mirror on the way out.
 *
 * Only the public read path uses this. The admin deliberately does not: an
 * editor opens a record, the form holds whatever the read returned, and saving
 * writes it back -- so rewriting the admin's reads would quietly migrate the
 * stored rows to mirror URLs, one save at a time. That would cost us the one
 * property this whole approach is built on, which is that the database is
 * untouched and unsetting NEXT_PUBLIC_MEDIA_MIRROR_HOST puts everything back.
 *
 * The rewrite is applied to the response body as text rather than to named
 * fields, because media URLs are not confined to named fields: they sit in
 * ordinary columns, inside markdown bodies, and nested anywhere in a page's
 * JSON. See `lib/media-mirror.ts`.
 */
export function createSupabasePublicClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  const rule = mirrorRewrite();
  if (!rule) return createSupabaseAdminClient();

  const rewritingFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    /* Only ever touch text. A storage download through this client would be
       bytes, and a string replace over bytes corrupts the file. */
    const type = response.headers.get("content-type") ?? "";
    if (!/json|text/i.test(type)) return response;

    const body = await response.text();
    const rewritten = rewriteMediaText(body, rule);
    if (rewritten === body) {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    /* content-length no longer matches once the host name changes length, and
       a wrong one makes the consumer truncate the body. Drop it and let the
       runtime work it out. */
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(rewritten, { status: response.status, statusText: response.statusText, headers });
  };

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: rewritingFetch }
  });
}
