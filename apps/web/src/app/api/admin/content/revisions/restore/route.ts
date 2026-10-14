import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canRestoreRevisions, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { restoreContentRevision } from "@/lib/admin/content-repository";
import { contentPathToRoutes } from "@/lib/content-paths";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRestoreRevisions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  try {
    const body = (await request.json()) as { revisionId?: string };
    const revisionId = body.revisionId?.trim() || "";
    if (!revisionId) return NextResponse.json({ error: "Missing revisionId" }, { status: 400 });

    const restored = await restoreContentRevision(revisionId, user.email);

    /*
     * A restore changes what a page says just as much as an edit does, so it
     * has to clear the same caches -- it did not, which made "回滚" look like
     * it had silently failed for up to five minutes. Same mapping the save
     * path uses, and a failure to clear must not fail the restore itself.
     */
    const revalidated: string[] = [];
    for (const route of contentPathToRoutes(restored.path)) {
      try {
        if (route === "/layout") revalidatePath("/", "layout");
        else revalidatePath(route);
        revalidated.push(route);
      } catch {
        /* The restore already succeeded; the cache will expire on its own. */
      }
    }
    return NextResponse.json({ ok: true, revalidated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore revision" },
      { status: 500 }
    );
  }
}
