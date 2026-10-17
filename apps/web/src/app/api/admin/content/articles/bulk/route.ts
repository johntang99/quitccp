import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { bulkSetPrimaryCategory, bulkUpdateArticleStatus } from "@/lib/admin/repository";
import { revalidateNews } from "@/lib/admin/revalidate-news";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * The slugs behind a batch of ids, so their own pages can be dropped too.
 *
 * One query rather than one per article, and a failure here must not fail the
 * operation: the write has already happened, and the listings are invalidated
 * either way. The cost of missing a slug is one article page that is stale for
 * the rest of its window, not a lost edit.
 */
async function slugsFor(ids: string[]): Promise<string[]> {
  try {
    const { data } = await createSupabaseAdminClient()
      .from("cms_articles")
      .select("slug")
      .in("id", ids);
    return (data ?? []).map((row) => String((row as { slug?: unknown }).slug ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const action = String(formData.get("action") ?? "review");
  const back = String(formData.get("back") ?? "/admin/articles");
  if (ids.length === 0) {
    return NextResponse.redirect(new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent("没有选中任何文章。")}`, request.url), 303);
  }

  try {
    if (action === "category") {
      const target = String(formData.get("category") ?? "").trim();
      if (!target) throw new Error("请先选择目标分类。");
      /* Read before the move: afterwards these slugs are unchanged, but doing it
         in one place keeps both branches alike. */
      const touched = await slugsFor(ids);
      const moved = await bulkSetPrimaryCategory(ids, target, user.email);
      await revalidateNews(touched);
      const msg = `已把 ${moved} 篇的主分类改为「${target}」。`;
      return NextResponse.redirect(
        new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`, request.url),
        303
      );
    }

    if ((action === "publish" || action === "archive") && !canBulkPublish(user)) {
      return NextResponse.json({ error: "只有管理员或超级管理员可以发布或归档。编辑请先「保存草稿」，再请管理员发布。" }, { status: 403 });
    }
    const nextStatus =
      action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
    const touched = await slugsFor(ids);
    await bulkUpdateArticleStatus(ids, nextStatus, user.email);
    await revalidateNews(touched);
    const label = action === "publish" ? "发布" : action === "archive" ? "归档" : "退回草稿";
    const msg = `已把 ${ids.length} 篇${label}。`;
    return NextResponse.redirect(
      new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`, request.url),
      303
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "批量操作失败。";
    return NextResponse.redirect(
      new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`, request.url),
      303
    );
  }
}
