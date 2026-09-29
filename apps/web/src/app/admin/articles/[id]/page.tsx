import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getArticleFormLookups } from "@/lib/admin/article-form-data";
import { getArticleById } from "@/lib/admin/repository";

interface EditArticlePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const user = await requireAdminSessionUser();
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();
  const { categories, authors } = await getArticleFormLookups(user.email);

  const statusLabel =
    article.status === "published" ? "已发布" : article.status === "archived" ? "已归档" : "草稿";

  return (
    <AdminShell user={user}>
      <section className="admin-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link className="admin-btn" href="/admin/articles">
          ← 返回列表
        </Link>
        <strong>{statusLabel}</strong>
        <h2 style={{ margin: 0, fontSize: 18 }}>编辑文章</h2>
        <code style={{ color: "#8a90a0" }}>/news/{article.slug}</code>
        <a className="admin-btn" style={{ marginLeft: "auto" }} href={`/news/${article.slug}`} target="_blank" rel="noopener noreferrer">
          在站点查看 ↗
        </a>
      </section>

      <ArticleForm
        mode="edit"
        currentUser={user.email.split("@")[0]}
        categories={categories}
        authors={authors}
        initial={{
          id: article.id,
          slug: article.slug,
          title: article.title,
          subtitle: article.subtitle,
          summary: article.summary,
          bodyMarkdown: article.bodyMarkdown,
          category: article.category,
          secondaryCategories: article.secondaryCategories,
          tags: article.tags,
          heroImage: article.heroImage,
          heroImageAlt: article.heroImageAlt,
          heroCredit: article.heroCredit,
          author: article.author,
          translator: article.translator,
          sourceTitle: article.sourceTitle,
          sourceUrl: article.sourceUrl,
          publishedAt: article.publishedAt,
          status: article.status,
          section: article.section,
          legacyId: article.legacyId
        }}
      />
    </AdminShell>
  );
}
