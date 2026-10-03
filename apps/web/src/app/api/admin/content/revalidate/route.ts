import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";

/**
 * Publish now: drop every cached page and rebuild on the next request.
 *
 * The public pages are ISR (`export const revalidate = 300`), so an edit that
 * does not itself call revalidatePath can take up to five minutes to appear --
 * and only then if somebody happens to request the page. That is fine as a
 * safety net and useless when you have just fixed a typo and want to see it.
 *
 * `revalidatePath("/", "layout")` invalidates every route under the root
 * layout, which is the whole public site, rather than guessing a list of paths
 * and missing one.
 */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "publish.revalidate")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  try {
    revalidatePath("/", "layout");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  void request;
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
