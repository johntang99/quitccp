import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { listMediaPage } from "@/lib/admin/repository";

/** One page of the library, for the grid's "load more". */
export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "video" ? "video" : "image";
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
  const limit = Number(url.searchParams.get("limit") ?? "60") || 60;

  try {
    const page = await listMediaPage(user.email, { type, offset, limit });
    return NextResponse.json(page);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败。" },
      { status: 500 }
    );
  }
}
