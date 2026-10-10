import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { findVideoBySlug, listVideoCategories, saveVideo } from "@/lib/admin/video-repository";
import { explainSaveFailure } from "@/lib/admin/save-errors";

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
  const flag = (name: string) => form.get(name) === "1";
  // The form saves over fetch and stays on the page; a plain post without
  // JavaScript still gets the redirects it expects.
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

  const title = text("title");
  const slug = text("slug");
  const id = text("id");
  const category = text("category");

  // Send the reason back to the form rather than a raw JSON page. Before this a
  // missing title was a bare 400, a taken slug was an unhandled 500 from the
  // unique index, and a category name that was not on the list saved the video
  // with no category at all and said 「已保存」.
  const backTo = id ? `/admin/videos/${id}` : "/admin/videos/new";
  const reject = (message: string) => {
    if (wantsJson) return NextResponse.json({ ok: false, error: message }, { status: 400 });
    const target = new URL(backTo, request.url);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target, 303);
  };

  if (!title) return reject("请填写标题。");
  if (!slug) return reject("请填写网址 slug。");
  if (!category) return reject("请选择分类。");

  const status = text("status") || "draft";
  if ((status === "published" || status === "archived") && !canBulkPublish(user)) {
    return reject("只有管理员或超级管理员可以发布或归档。编辑请先「保存草稿」，再请管理员发布。");
  }

  const known = await listVideoCategories();
  if (!known.some((row) => row.name === category)) return reject(`分类不存在：${category}`);

  const clash = await findVideoBySlug(slug, id || undefined);
  if (clash) return reject(`网址「${slug}」已被《${clash.title}》占用，请换一个。`);

  // The form sends an instant (ISO with offset). A bare datetime-local value
  // would be read in the server's zone, which is not the editor's.
  const publishedRaw = text("publishedAt");
  const published = publishedRaw ? new Date(publishedRaw) : null;

  let savedId = id;
  try {
    savedId = await saveVideo({
      id: id || undefined,
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
      category,
      featured: flag("featured"),
      editorArchive: flag("editorArchive")
    }, user.email);
  } catch (error) {
    return reject(explainSaveFailure(error));
  }

  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      id: savedId,
      slug,
      status,
      savedAt: new Date().toISOString()
    });
  }

  const target = new URL("/admin/videos", request.url);
  target.searchParams.set("msg", `已保存《${title}》`);
  return NextResponse.redirect(target, 303);
}
