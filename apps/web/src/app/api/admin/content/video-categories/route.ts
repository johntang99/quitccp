import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { upsertVideoCategory } from "@/lib/admin/video-repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  const sortRaw = String(formData.get("sortOrder") ?? "").trim();

  const back = (query: string) =>
    NextResponse.redirect(new URL(`/admin/video-categories?${query}`, request.url), 303);

  try {
    await upsertVideoCategory({
      id: String(formData.get("id") ?? "").trim() || undefined,
      slug: String(formData.get("slug") ?? "").trim() || undefined,
      name,
      sortOrder: sortRaw === "" ? undefined : Number(sortRaw)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败。";
    return back(`error=${encodeURIComponent(message)}`);
  }
  return back(`msg=${encodeURIComponent(`已保存「${name}」。`)}`);
}
