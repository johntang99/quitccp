import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { listRevisions } from "@/lib/admin/repository";

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  if (entityType === "page" || entityType === "article") {
    return NextResponse.json({ rows: await listRevisions(user.email, entityType) });
  }
  return NextResponse.json({ rows: await listRevisions(user.email) });
}
