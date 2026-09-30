import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { getArticleFormLookups } from "@/lib/admin/article-form-data";

export default async function NewArticlePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdminSessionUser();
  const { categories, authors } = await getArticleFormLookups(user.email);
  // The save endpoint sends the reason back here rather than leaving the
  // editor on a bare 404 wondering what happened.
  const error = (await searchParams).error;

  return (
    <AdminShell user={user}>
      <ArticleTabs active="new" />

      {error ? (
        <section className="admin-card" style={{ background: "#fdf1f0", borderColor: "#f2c9c4" }}>
          <strong style={{ color: "#b42318" }}>{error}</strong>
        </section>
      ) : null}

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
