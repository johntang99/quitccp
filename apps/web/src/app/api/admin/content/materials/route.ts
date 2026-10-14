import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { saveMaterial, type MaterialFile } from "@/lib/admin/material-repository";
import { revalidateMaterials } from "@/lib/admin/revalidate-pages";
import { warmPathsForMaterial } from "@/lib/admin/warm-paths";

/** Parses the form's `filesJson`, dropping rows an editor left blank. */
function parseFiles(raw: string): MaterialFile[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row) => ({
        label: String(row.label ?? "").trim(),
        url: String(row.url ?? "").trim(),
        kind: String(row.kind ?? "").trim()
      }))
      .filter((row) => row.url);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Throws when MFA is required but the session never passed a TOTP check.
  // Uncaught it surfaces as a bare 500, which tells an editor nothing.
  try {
    requireAdminMfa(user);
  } catch {
    return NextResponse.json({ error: "需要通过两步验证后才能上传或保存。" }, { status: 403 });
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");

  if (!slug || !title) {
    return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
  }
  if ((status === "published" || status === "archived") && !canBulkPublish(user)) {
    return NextResponse.json({ error: "只有管理员或超级管理员可以发布或归档。编辑请先「保存草稿」，再请管理员发布。" }, { status: 403 });
  }

  const publishedAtRaw = String(formData.get("publishedAt") ?? "").trim();

  const savedId = await saveMaterial({
    id: id || undefined,
    slug,
    title,
    summary: String(formData.get("summary") ?? ""),
    bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
    coverImage: String(formData.get("coverImage") ?? "").trim(),
    coverImageAlt: String(formData.get("coverImageAlt") ?? "").trim(),
    files: parseFiles(String(formData.get("filesJson") ?? "[]")),
    status,
    featured: formData.get("featured") === "1",
    // An empty box means "leave it to the status rule" rather than "clear it",
    // so only a typed value is passed through.
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw).toISOString() : undefined,
    categoryIds: String(formData.get("categoryIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  }, user.email);

  /* The material's own page, its category listing and the resources home
     all show it; without this the editor sees the old copy for five minutes. */
  revalidateMaterials([slug]);

  // Back to the same material, not to the list: an editor usually saves more
  // than once, and bouncing to the list loses their place.
  /* This form posts and redirects rather than saving over fetch, so the paths
     to warm travel in the query string and a small client component on the
     landing page does the fetching. */
  const back = new URL(`/admin/materials/${savedId}`, request.url);
  back.searchParams.set("msg", "saved");
  /* A fragment, so the paths cannot be rendered into this page's own links. */
  back.hash = `warm=${encodeURIComponent(warmPathsForMaterial(slug).join(","))}`;
  return NextResponse.redirect(back, 303);
}
