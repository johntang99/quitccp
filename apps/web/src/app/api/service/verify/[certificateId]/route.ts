import { NextRequest, NextResponse } from "next/server";
import { getServiceUserFromHeaders } from "@/lib/service/auth";
import { findCertificateByIdOrSerial } from "@/lib/service/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const user = await getServiceUserFromHeaders(request);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  if (!user.mfaPassed) return NextResponse.json({ error: "MFA required" }, { status: 403 });

  const resolvedParams = await params;
  const row = await findCertificateByIdOrSerial(resolvedParams.certificateId, user.email);
  if (!row) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  return NextResponse.json({ row });
}
