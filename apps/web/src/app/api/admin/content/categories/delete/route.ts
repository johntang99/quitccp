import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteCategoryById } from "@/lib/admin/repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing category id" }, { status: 400 });

  try {
    await deleteCategoryById(id, user.email);
    return NextResponse.redirect(new URL("/admin/categories", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete category";
    return NextResponse.redirect(
      new URL(`/admin/categories?error=${encodeURIComponent(message)}`, request.url),
      303
    );
  }
}
