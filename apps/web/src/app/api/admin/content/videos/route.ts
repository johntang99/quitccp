import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { listVideos, upsertVideoRecord } from "@/lib/admin/repository";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listVideos(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
  const coverAssetId = String(formData.get("coverAssetId") ?? "").trim();
  const downloadAssetId = String(formData.get("downloadAssetId") ?? "").trim();
  const platformIdsJson = String(formData.get("platformIdsJson") ?? "{}");
  const status = String(formData.get("status") ?? "draft") as "draft" | "published" | "archived";

  if (!slug || !title) {
    return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
  }
  if ((status === "published" || status === "archived") && !canBulkPublish(user)) {
    return NextResponse.json({ error: "Only super_admin/content_admin can publish/archive" }, { status: 403 });
  }

  await upsertVideoRecord(
    {
      id: id || undefined,
      slug,
      title,
      description,
      durationSeconds: durationRaw ? Number(durationRaw) : undefined,
      coverAssetId: coverAssetId || undefined,
      downloadAssetId: downloadAssetId || undefined,
      platformIdsJson,
      status
    },
    user.email
  );
  return NextResponse.redirect(new URL("/admin/videos", request.url), 303);
}
