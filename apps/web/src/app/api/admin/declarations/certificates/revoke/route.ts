import { NextResponse } from "next/server";
import { canAccessDeclarations, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { revokeCertificate } from "@/lib/admin/declarations-repository";
import { toErrorMessage } from "@/lib/admin/error-message";
import { readAdminForm, redirectBackToQueue } from "../../shared";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessDeclarations(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await readAdminForm(request);
  if (!formData) return NextResponse.json({ error: "Expected a form submission" }, { status: 415 });

  const certificateId = String(formData.get("certificateId") ?? "").trim();
  if (!certificateId) return NextResponse.json({ error: "certificateId is required" }, { status: 400 });

  try {
    await revokeCertificate(certificateId, user.email);
    return redirectBackToQueue(request, formData, { ok: "已作废该证明" });
  } catch (error) {
    return redirectBackToQueue(request, formData, {
      error: toErrorMessage(error, "Revoke failed")
    });
  }
}
