import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteArticleById, getArticleById } from "@/lib/admin/repository";
import { revalidateNews } from "@/lib/admin/revalidate-news";
import { warmPathsForDeletedArticle } from "@/lib/admin/warm-paths";

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing article id" }, { status: 400 });

  /* Read before the delete: afterwards there is no row to learn the slug from,
     and without it the article's own page keeps answering from cache for the
     rest of the window -- a deleted article, still readable. */
  const slug = (await getArticleById(id))?.slug ?? "";

  await deleteArticleById(id, user.email);
  await revalidateNews(slug ? [slug] : []);

  /* The article's own page is gone, so there is nothing to warm there -- but
     the listings it vanished from are about to be read. */
  /* A fragment, not a query parameter: the list page renders its own filter
     and pagination links from the parameters it receives, so `?warm=` came
     back embedded in every one of them. A fragment never reaches the server. */
  const back = new URL("/admin/articles", request.url);
  back.hash = `warm=${encodeURIComponent(warmPathsForDeletedArticle().join(","))}`;
  return NextResponse.redirect(back, 303);
}
