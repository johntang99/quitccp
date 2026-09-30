import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { saveVideo } from "@/lib/admin/video-repository";

/**
 * Save endpoint for the video form.
 *
 * Separate from `/api/admin/content/videos`, which predates the category and
 * source columns and still writes the old shape from the Dashboard.
 */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const form = await request.formData();
  const text = (name: string) => String(form.get(name) ?? "").trim();

  const title = text("title");
  const slug = text("slug");
  if (!title || !slug) {
    return NextResponse.json({ error: "标题和 slug 都是必填的。" }, { status: 400 });
  }

  const status = text("status") || "draft";
  if ((status === "published" || status === "archived") && !canBulkPublish(user)) {
    return NextResponse.json({ error: "只有 super_admin／content_admin 可以发布或归档。" }, { status: 403 });
  }

  // The form sends an instant (ISO with offset). A bare datetime-local value
  // would be read in the server's zone, which is not the editor's.
  const publishedRaw = text("publishedAt");
  const published = publishedRaw ? new Date(publishedRaw) : null;

  const id = await saveVideo({
    id: text("id") || undefined,
    slug,
    title,
    episode: text("episode"),
    description: String(form.get("description") ?? ""),
    bodyMarkdown: String(form.get("bodyMarkdown") ?? ""),
    sourceUrl: text("sourceUrl"),
    backupUrl: text("backupUrl"),
    coverImage: text("coverImage"),
    coverImageAlt: text("coverImageAlt"),
    speaker: text("speaker"),
    sourceCredit: text("sourceCredit"),
    status,
    publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
    category: text("category")
  });

  const target = new URL("/admin/videos", request.url);
  target.searchParams.set("msg", `已保存《${title}》`);
  void id;
  return NextResponse.redirect(target, 303);
}
