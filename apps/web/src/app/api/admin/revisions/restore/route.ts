import { NextResponse } from "next/server";
import { canRestoreRevisions, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { restoreRevision } from "@/lib/admin/repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRestoreRevisions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);
  const formData = await request.formData();
  const revisionId = String(formData.get("revisionId") ?? "");
  await restoreRevision(revisionId, user.email);

  return NextResponse.redirect(new URL("/admin/revisions", request.url), 303);
}
