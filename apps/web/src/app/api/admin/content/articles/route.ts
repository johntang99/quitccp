import { NextResponse } from "next/server";
import { adminCanWrite, canBulkPublish, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { listArticles, listCategories, upsertArticleRecord } from "@/lib/admin/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  const status = searchParams.get("status");
  const locale = searchParams.get("locale");
  const category = searchParams.get("category");
  const cursor = searchParams.get("cursor");
  const q = searchParams.get("q")?.toLowerCase();

  const result = await listArticles(
    {
      page,
      pageSize,
      status: status ?? undefined,
      locale: locale ?? undefined,
      category: category ?? undefined,
      q: q ?? undefined,
      cursor: cursor ?? undefined
    },
    user.email
  );
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");
  const section = String(formData.get("section") ?? "news");
  const locale = String(formData.get("locale") ?? "zh");
  const status = String(formData.get("status") ?? "draft") as
    | "draft"
    | "review"
    | "published"
    | "archived";
  const category = String(formData.get("category") ?? "news");
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const bodyMarkdown = String(formData.get("bodyMarkdown") ?? "");
  const bodyPlain = bodyMarkdown.replace(/[#>*_`-]/g, " ").replace(/\s+/g, " ").trim();
  const legacyUrlRaw = String(formData.get("legacyUrl") ?? "");
  const legacyIdRaw = String(formData.get("legacyId") ?? "");

  if ((status === "published" || status === "archived") && !canBulkPublish(user)) {
    return NextResponse.json(
      { error: "Only super_admin/content_admin can publish or archive directly" },
      { status: 403 }
    );
  }

  // The form checks these in the browser, but the endpoint has to as well: a
  // title-less post used to come back as a bare 404, and an empty slug wrote a
  // row that no URL could ever reach.
  // The form saves over fetch so the editor stays on the page; a plain form
  // post (no JavaScript) still gets the redirects it expects.
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const backTo = id ? `/admin/articles/${id}` : "/admin/articles/new";
  const reject = (message: string) => {
    if (wantsJson) return NextResponse.json({ ok: false, error: message }, { status: 400 });
    const target = new URL(backTo, request.url);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target, 303);
  };
  if (!title.trim()) return reject("请填写标题。");
  if (!slug.trim()) return reject("请填写网址 slug。");
  if (!category.trim()) return reject("请选择主分类。");

  // A category is chosen from a list, so a name that is not on it is a typo or
  // a hand-made request -- not a new category. Creating one silently meant a
  // single mistyped character grew the taxonomy by one and hid the article in it.
  const known = (await listCategories(user.email)).map((row) => row.name);
  const unknown = [category, ...(String(formData.get("secondaryCategories") ?? "")
    .split(",").map((name) => name.trim()).filter(Boolean))]
    .filter((name) => !known.includes(name));
  if (unknown.length > 0) return reject(`分类不存在：${unknown.join("、")}`);

  try {
    await upsertArticleRecord(
      {
        id,
        slug,
        title,
        section,
        locale,
        status,
        bodyMarkdown,
        bodyPlain,
        category,
        tags,
        legacyUrl: legacyUrlRaw || undefined,
        legacyId: legacyIdRaw ? Number(legacyIdRaw) : undefined,
        subtitle: String(formData.get("subtitle") ?? ""),
        summary: String(formData.get("summary") ?? ""),
        secondaryCategories: String(formData.get("secondaryCategories") ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        heroImage: String(formData.get("heroImage") ?? ""),
        heroImageAlt: String(formData.get("heroImageAlt") ?? ""),
        heroCredit: String(formData.get("heroCredit") ?? ""),
        author: String(formData.get("author") ?? ""),
        translator: String(formData.get("translator") ?? ""),
        sourceTitle: String(formData.get("sourceTitle") ?? ""),
        sourceUrl: String(formData.get("sourceUrl") ?? ""),
        publishedAt: String(formData.get("publishedAt") ?? "").trim() || null,
      // Checkboxes post nothing when unchecked, so absence means false.
      featured: String(formData.get("featured") ?? "") === "1",
      editorArchive: String(formData.get("editorArchive") ?? "") === "1",
      },
      user.email
    );
  } catch (error) {
    return reject(error instanceof Error ? error.message : "保存失败。");
  }

  if (wantsJson) {
    // The id matters for a new article: the form switches to editing it, so a
    // second save updates rather than creating a duplicate.
    const { data: saved } = await createSupabaseAdminClient()
      .from("cms_articles")
      .select("id, slug")
      .eq("slug", slug)
      .eq("locale", locale)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      id: saved ? String(saved.id) : id,
      slug: saved ? String(saved.slug) : slug,
      status,
      savedAt: new Date().toISOString()
    });
  }

  return NextResponse.redirect(new URL("/admin/articles", request.url), 303);
}
