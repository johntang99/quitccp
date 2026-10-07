import { NextResponse } from "next/server";
import { upsertFaqCategory } from "@/lib/admin/faq-repository";
import { guardFaqWrite } from "@/lib/admin/faq-guard";

export async function POST(request: Request) {
  const { user, error } = await guardFaqWrite();
  if (error) return error;
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if (!slug || !name) return NextResponse.json({ error: "slug and name are required" }, { status: 400 });

  await upsertFaqCategory(
    {
      id: String(form.get("id") ?? "").trim() || undefined,
      slug,
      name,
      summary: String(form.get("summary") ?? "").trim(),
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0
    },
    user!.email
  );
  return NextResponse.redirect(new URL("/admin/faq/categories", request.url), 303);
}
