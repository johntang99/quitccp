import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { exportContentEntries } from "@/lib/admin/content-repository";

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || "zh";
    const rows = await exportContentEntries(locale, user.email);
    return NextResponse.json({ locale, rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export content" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
