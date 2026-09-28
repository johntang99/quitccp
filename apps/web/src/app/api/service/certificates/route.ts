import { NextRequest, NextResponse } from "next/server";
import { getServiceUserFromHeaders, serviceCanWrite } from "@/lib/service/auth";
import { createCertificateRecord } from "@/lib/service/repository";

export async function POST(request: NextRequest) {
  const user = await getServiceUserFromHeaders(request);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  if (!user.mfaPassed) return NextResponse.json({ error: "MFA required" }, { status: 403 });
  if (!serviceCanWrite(user.role)) {
    return NextResponse.json({ error: "Write permission required" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    declarationId?: string;
    serialNumber?: string;
    status?: "pending" | "issued" | "revoked";
  };
  if (!body.declarationId || !body.status) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const row = await createCertificateRecord(
    {
      id: body.id,
      declarationId: body.declarationId,
      serialNumber: body.serialNumber,
      status: body.status
    },
    user.email
  );

  return NextResponse.json({ row }, { status: 201 });
}
