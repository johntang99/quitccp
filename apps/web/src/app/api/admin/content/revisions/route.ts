import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { listContentRevisions } from "@/lib/admin/content-repository";

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || "zh";
    const path = searchParams.get("path") || "";
    const limit = Number(searchParams.get("limit") || "20");
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    const rows = await listContentRevisions(locale, path, user.email, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list revisions" },
      { status: 500 }
    );
  }
}
