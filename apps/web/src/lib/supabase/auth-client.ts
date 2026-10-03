import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * The Supabase client that carries the signed-in admin's session.
 *
 * Distinct from `createSupabaseAdminClient()`, which holds the service-role key
 * and answers as the database owner. This one holds the anon key and whatever
 * session the request's cookies carry, so it is what `auth.getUser()` is asked.
 *
 * Next 15 only allows cookies to be written from a Route Handler or a Server
 * Action. Reading the session from a Server Component is legitimate and common,
 * and the library will try to refresh an expiring token while it does -- so the
 * writes are wrapped rather than allowed to throw. A refresh that cannot be
 * persisted is not an error: the next Route Handler will do it.
 */
export async function createSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component: not writable, and not fatal. See above.
        }
      }
    }
  });
}
