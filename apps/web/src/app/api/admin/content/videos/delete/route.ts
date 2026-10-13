import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteVideoById } from "@/lib/admin/repository";
import { revalidateVideos } from "@/lib/admin/revalidate-videos";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing video id" }, { status: 400 });

  const { slug } = await deleteVideoById(id, user.email);
  await revalidateVideos(slug ? [slug] : []);

  return NextResponse.redirect(new URL("/admin/videos", request.url), 303);
}
