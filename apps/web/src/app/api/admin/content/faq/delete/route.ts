import { NextResponse } from "next/server";
import { canBulkPublish } from "@/lib/admin/auth";
import { deleteFaq } from "@/lib/admin/faq-repository";
import { guardFaqWrite } from "@/lib/admin/faq-guard";

export async function POST(request: Request) {
  const { user, error } = await guardFaqWrite();
  if (error) return error;
  if (!canBulkPublish(user!)) {
    return NextResponse.json({ error: "只有管理员或超级管理员可以删除问答。" }, { status: 403 });
  }
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  if (id) await deleteFaq(id, user!.email);
  return NextResponse.redirect(new URL("/admin/faq", request.url), 303);
}
