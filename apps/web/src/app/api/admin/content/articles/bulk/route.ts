import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { bulkUpdateArticleStatus } from "@/lib/admin/repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const action = String(formData.get("action") ?? "review");
  if ((action === "publish" || action === "archive") && !canBulkPublish(user)) {
    return NextResponse.json({ error: "Insufficient role for publish/archive" }, { status: 403 });
  }
  const nextStatus =
    action === "publish" ? "published" : action === "archive" ? "archived" : "review";
  await bulkUpdateArticleStatus(ids, nextStatus, user.email);

  return NextResponse.redirect(new URL("/admin/articles", request.url), 303);
}
