import { NextResponse } from "next/server";
import { canAccessDeclarations, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { issueCertificate } from "@/lib/admin/declarations-repository";
import { toErrorMessage } from "@/lib/admin/error-message";
import { readAdminForm, redirectBackToQueue } from "../shared";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessDeclarations(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await readAdminForm(request);
  if (!formData) return NextResponse.json({ error: "Expected a form submission" }, { status: 415 });

  const declarationId = String(formData.get("declarationId") ?? "").trim();
  const holderName = String(formData.get("holderName") ?? "");
  if (!declarationId) return NextResponse.json({ error: "declarationId is required" }, { status: 400 });

  try {
    const { serialNumber } = await issueCertificate(declarationId, holderName, user.email);
    return redirectBackToQueue(request, formData, { ok: `已签发证明 ${serialNumber}` });
  } catch (error) {
    return redirectBackToQueue(request, formData, {
      error: toErrorMessage(error, "Issue failed")
    });
  }
}
