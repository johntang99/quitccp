import { NextResponse } from "next/server";
import { t } from "@/lib/i18n";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { bulkSetPrimaryCategory, bulkUpdateArticleStatus } from "@/lib/admin/repository";
import { revalidateNews } from "@/lib/admin/revalidate-news";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SITE_LOCALE } from "@/lib/site-config";

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
      .eq("locale", SITE_LOCALE)
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
    return NextResponse.redirect(new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(t("admin.bulk.nothingSelected"))}`, request.url), 303);
  }

  try {
    if (action === "category") {
      const target = String(formData.get("category") ?? "").trim();
      if (!target) throw new Error(t("admin.bulk.pickTargetFirst"));
      /* Read before the move: afterwards these slugs are unchanged, but doing it
         in one place keeps both branches alike. */
      const touched = await slugsFor(ids);
      const moved = await bulkSetPrimaryCategory(ids, target, user.email);
      await revalidateNews(touched);
      const msg = t("admin.bulk.movedCategory", { n: moved, target });
      return NextResponse.redirect(
        new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`, request.url),
        303
      );
    }

    if ((action === "publish" || action === "archive") && !canBulkPublish(user)) {
      return NextResponse.json({ error: t("admin.bulk.forbidden") }, { status: 403 });
    }
    const nextStatus =
      action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
    const touched = await slugsFor(ids);
    await bulkUpdateArticleStatus(ids, nextStatus, user.email);
    await revalidateNews(touched);
    const label = t(
      action === "publish"
        ? "admin.bulk.action.publish"
        : action === "archive"
          ? "admin.bulk.action.archive"
          : "admin.bulk.action.draft"
    );
    const msg = t("admin.bulk.done", { n: ids.length, action: label });
    return NextResponse.redirect(
      new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`, request.url),
      303
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : t("admin.bulk.failed");
    return NextResponse.redirect(
      new URL(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`, request.url),
      303
    );
  }
}
