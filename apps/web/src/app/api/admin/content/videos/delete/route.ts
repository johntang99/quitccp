import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteVideoById } from "@/lib/admin/repository";
import { revalidateVideos } from "@/lib/admin/revalidate-videos";
import { warmPathsForDeletedVideo } from "@/lib/admin/warm-paths";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing video id" }, { status: 400 });

  const { slug } = await deleteVideoById(id, user.email);
  await revalidateVideos(slug ? [slug] : []);

  /* The video's own page is gone, but the listings it vanished from are about
     to be read. Article deletion already did this; videos were missed, which a
     production test caught: /videos came back REVALIDATED rather than HIT. */
  const back = new URL("/admin/videos", request.url);
  back.hash = `warm=${encodeURIComponent(warmPathsForDeletedVideo().join(","))}`;
  return NextResponse.redirect(back, 303);
}
