import { NextResponse } from "next/server";
import { moveFaq } from "@/lib/admin/faq-repository";
import { guardFaqWrite } from "@/lib/admin/faq-guard";

export async function POST(request: Request) {
  const { user, error } = await guardFaqWrite();
  if (error) return error;
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const direction = String(form.get("direction") ?? "") === "up" ? "up" : "down";
  if (id) await moveFaq(id, direction, user!.email);
  return NextResponse.redirect(new URL("/admin/faq", request.url), 303);
}
