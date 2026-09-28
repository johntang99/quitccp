import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteImageAsset } from "@/lib/admin/media-storage";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    requireAdminMfa(user);
  } catch {
    return NextResponse.json({ error: "MFA required" }, { status: 403 });
  }

  let id = "";
  try {
    id = String(((await request.json()) as { id?: string }).id ?? "").trim();
  } catch {
    return NextResponse.json({ error: "请求格式有误。" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "缺少 id。" }, { status: 400 });

  try {
    await deleteImageAsset(id, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败。" },
      { status: 500 }
    );
  }
}
