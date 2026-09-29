import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getArticleFormLookups } from "@/lib/admin/article-form-data";

export default async function NewArticlePage() {
  const user = await requireAdminSessionUser();
  const { categories, authors } = await getArticleFormLookups(user.email);

  return (
    <AdminShell user={user}>
      <section className="admin-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="admin-btn" href="/admin/articles">
          ← 返回列表
        </Link>
        <h2 style={{ margin: 0 }}>新建文章</h2>
      </section>

      <ArticleForm
        mode="new"
        currentUser={user.email.split("@")[0]}
        categories={categories}
        authors={authors}
        initial={{
          slug: "",
          title: "",
          subtitle: "",
          summary: "",
          bodyMarkdown: "",
          category: "",
          secondaryCategories: [],
          tags: [],
          heroImage: "",
          heroImageAlt: "",
          heroCredit: "",
          author: "",
          translator: "",
          sourceTitle: "",
          sourceUrl: "",
          publishedAt: new Date().toISOString(),
          status: "draft",
          section: "news"
        }}
      />
    </AdminShell>
  );
}
