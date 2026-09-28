import { NextResponse } from "next/server";
import { canRestoreRevisions, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { restoreContentRevision } from "@/lib/admin/content-repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRestoreRevisions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  try {
    const body = (await request.json()) as { revisionId?: string };
    const revisionId = body.revisionId?.trim() || "";
    if (!revisionId) return NextResponse.json({ error: "Missing revisionId" }, { status: 400 });

    await restoreContentRevision(revisionId, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore revision" },
      { status: 500 }
    );
  }
}
