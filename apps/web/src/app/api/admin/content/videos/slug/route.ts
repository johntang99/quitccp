import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { findVideoBySlug } from "@/lib/admin/video-repository";

/** Is this video slug free, and if not, what is? Mirrors the article endpoint. */
export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").trim();
  const selfId = (searchParams.get("id") ?? "").trim();
  if (!slug) return NextResponse.json({ slug: "", available: false, suggestion: "" });

  const clash = await findVideoBySlug(slug, selfId || undefined);
  if (!clash) return NextResponse.json({ slug, available: true, suggestion: slug });

  let suggestion = slug;
  for (let n = 2; n <= 50; n += 1) {
    suggestion = `${slug}-${n}`;
    if (!(await findVideoBySlug(suggestion, selfId || undefined))) break;
  }
  return NextResponse.json({ slug, available: false, takenBy: clash.title, suggestion });
}
