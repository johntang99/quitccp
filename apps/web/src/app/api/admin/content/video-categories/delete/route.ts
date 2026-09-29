import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteVideoCategory } from "@/lib/admin/video-repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const id = String((await request.formData()).get("id") ?? "").trim();
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/admin/video-categories?${query}`, request.url), 303);
  if (!id) return back(`error=${encodeURIComponent("缺少分类 id。")}`);

  try {
    await deleteVideoCategory(id);
  } catch (error) {
    return back(`error=${encodeURIComponent(error instanceof Error ? error.message : "删除失败。")}`);
  }
  return back(`msg=${encodeURIComponent("分类已删除。")}`);
}
