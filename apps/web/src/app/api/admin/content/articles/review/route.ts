import { NextResponse } from "next/server";
import { canReviewArticles, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { getArticleById, upsertArticleRecord } from "@/lib/admin/repository";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReviewArticles(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "request_changes");
  if (!["request_changes", "approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "Invalid review decision" }, { status: 400 });
  }
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  const nextStatus =
    decision === "approved" ? "published" : decision === "rejected" ? "archived" : "draft";
  await upsertArticleRecord({ ...article, status: nextStatus }, user.email);
  return NextResponse.redirect(new URL("/admin/articles", request.url), 303);
}
