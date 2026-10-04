import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { bulkSetVideoCategory, bulkSetVideoStatus } from "@/lib/admin/video-repository";

/** Bulk re-file or re-status, the video half of the article bulk endpoint. */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const form = await request.formData();
  const ids = form.getAll("ids").map((value) => String(value)).filter(Boolean);
  const action = String(form.get("action") ?? "");
  const category = String(form.get("category") ?? "").trim();

  const back = (message: string) => {
    const target = new URL("/admin/videos", request.url);
    target.searchParams.set("msg", message);
    return NextResponse.redirect(target, 303);
  };

  if (ids.length === 0) return back("没有勾选任何视频。");

  try {
    if (action === "category") {
      if (!category) return back("请先选择目标分类。");
      const changed = await bulkSetVideoCategory(ids, category);
      return back(`已把 ${changed} 个视频的主分类改为「${category}」。`);
    }
    if (action === "published" || action === "draft" || action === "archived") {
      if ((action === "published" || action === "archived") && !canBulkPublish(user)) {
        return back("只有管理员或超级管理员可以发布或归档。编辑请先「保存草稿」，再请管理员发布。");
      }
      const changed = await bulkSetVideoStatus(ids, action);
      const label = action === "published" ? "已发布" : action === "draft" ? "草稿" : "已归档";
      return back(`已把 ${changed} 个视频设为${label}。`);
    }
    return back("认不出的操作。");
  } catch (error) {
    return back(error instanceof Error ? error.message : "批量操作失败。");
  }
}
