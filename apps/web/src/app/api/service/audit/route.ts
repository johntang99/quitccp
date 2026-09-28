import { NextRequest, NextResponse } from "next/server";
import { getServiceUserFromHeaders } from "@/lib/service/auth";
import { listServiceAudits } from "@/lib/service/repository";

export async function GET(request: NextRequest) {
  const user = await getServiceUserFromHeaders(request);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  if (!user.mfaPassed) return NextResponse.json({ error: "MFA required" }, { status: 403 });
  const rows = await listServiceAudits(user.email);
  return NextResponse.json({ rows });
}
