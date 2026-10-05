import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { setMediaDescription } from "@/lib/admin/repository";

/** Caption for one asset in the picture and video library. */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  let body: { id?: string; description?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "缺少资源 id。" }, { status: 400 });
  // Captioned, not annotated: this is a label in a library, and an open-ended
  // text column invites someone to paste an article into it.
  const description = String(body.description ?? "").slice(0, 500);

  try {
    await setMediaDescription(id, description, user.email);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败。" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, description: description.trim() });
}
