import { NextRequest, NextResponse } from "next/server";
import { getServiceUserFromHeaders, serviceCanWrite } from "@/lib/service/auth";
import { createDeclarationRecord, listDeclarations } from "@/lib/service/repository";

export async function GET(request: NextRequest) {
  const user = await getServiceUserFromHeaders(request);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  if (!user.mfaPassed) return NextResponse.json({ error: "MFA required" }, { status: 403 });
  const rows = await listDeclarations(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: NextRequest) {
  const user = await getServiceUserFromHeaders(request);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  if (!user.mfaPassed) return NextResponse.json({ error: "MFA required" }, { status: 403 });
  if (!serviceCanWrite(user.role)) {
    return NextResponse.json({ error: "Write permission required" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    alias?: string;
    organizationScopes?: string[];
    statement?: string;
  };
  if (!body.alias || !body.statement || !Array.isArray(body.organizationScopes)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const row = await createDeclarationRecord(
    {
      id: body.id,
      alias: body.alias,
      organizationScopes: body.organizationScopes,
      statement: body.statement
    },
    user.email
  );

  return NextResponse.json({ row }, { status: 201 });
}
