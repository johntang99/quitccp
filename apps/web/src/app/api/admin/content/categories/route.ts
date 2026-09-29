import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { listCategories, upsertCategoryRecord } from "@/lib/admin/repository";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listCategories(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  if (sortOrder !== undefined && !Number.isFinite(sortOrder)) {
    return NextResponse.redirect(
      new URL(`/admin/categories?error=${encodeURIComponent("排序必须是数字。")}`, request.url),
      303
    );
  }

  try {
    await upsertCategoryRecord(
      { id: id || undefined, slug: slug || undefined, name, sortOrder },
      user.email
    );
  } catch (error) {
    // Surfaced in the page's error banner -- most often the "give a latin slug
    // for a Chinese name" rule.
    const message = error instanceof Error ? error.message : "保存分类失败。";
    return NextResponse.redirect(
      new URL(`/admin/categories?error=${encodeURIComponent(message)}`, request.url),
      303
    );
  }
  return NextResponse.redirect(new URL("/admin/categories", request.url), 303);
}
