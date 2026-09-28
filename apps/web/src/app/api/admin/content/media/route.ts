import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { listMedia, upsertMediaRecord } from "@/lib/admin/repository";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listMedia(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "image") as "image" | "document" | "video-cover";
  const url = String(formData.get("url") ?? "");
  await upsertMediaRecord({ id, name, type, url }, user.email);
  return NextResponse.redirect(new URL("/admin/media", request.url), 303);
}
