import { NextResponse } from "next/server";
import { canAccessDeclarations, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { reviewDeclaration } from "@/lib/admin/declarations-repository";
import { toErrorMessage } from "@/lib/admin/error-message";
import { readAdminForm, redirectBackToQueue } from "../shared";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessDeclarations(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await readAdminForm(request);
  if (!formData) return NextResponse.json({ error: "Expected a form submission" }, { status: 415 });

  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!["publish", "reject", "return_to_pending"].includes(decision)) {
    return NextResponse.json({ error: "Invalid review decision" }, { status: 400 });
  }

  try {
    await reviewDeclaration(id, decision as "publish" | "reject" | "return_to_pending", user.email);
  } catch (error) {
    return redirectBackToQueue(request, formData, {
      error: toErrorMessage(error, "Review failed")
    });
  }
  return redirectBackToQueue(request, formData, { ok: "已更新声明状态" });
}
