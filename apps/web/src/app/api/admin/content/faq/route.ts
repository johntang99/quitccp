import { NextResponse } from "next/server";
import { canBulkPublish } from "@/lib/admin/auth";
import { guardFaqWrite } from "@/lib/admin/faq-guard";
import { saveFaq } from "@/lib/admin/faq-repository";

export async function POST(request: Request) {
  const { user, error } = await guardFaqWrite();
  if (error) return error;

  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const question = String(form.get("question") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim();
  const status = String(form.get("status") ?? "draft");

  if (!question || !slug) {
    return NextResponse.json({ error: "question and slug are required" }, { status: 400 });
  }
  if ((status === "published" || status === "archived") && !canBulkPublish(user!)) {
    return NextResponse.json(
      { error: "只有管理员或超级管理员可以发布或归档。编辑请先「保存草稿」。" },
      { status: 403 }
    );
  }

  const savedId = await saveFaq(
    {
      id: id || undefined,
      slug,
      question,
      answerMarkdown: String(form.get("answerMarkdown") ?? ""),
      categoryId: String(form.get("categoryId") ?? "").trim(),
      status
    },
    user!.email
  );

  // Back to the same question, like the material editor: editors save more than
  // once, and bouncing to the list loses their place.
  return NextResponse.redirect(new URL(`/admin/faq/${savedId}?msg=saved`, request.url), 303);
}
