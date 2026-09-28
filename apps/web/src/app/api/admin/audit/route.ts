import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { listAudits } from "@/lib/admin/repository";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listAudits(user.email);
  return NextResponse.json({ rows });
}
