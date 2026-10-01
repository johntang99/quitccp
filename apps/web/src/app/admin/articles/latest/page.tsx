import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { searchArticles } from "@/lib/admin/article-search";
import { listCategories } from "@/lib/admin/repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * 最新 100 篇 — the same rows as 查找与修改 without the search step.
 *
 * Ordered by publication date by default. It used to sort on updated_at, which
 * carries no information here: the migration wrote all 15,514 articles in a few
 * minutes, so the top 300 rows share just 18 timestamps and the order inside
 * each batch is arbitrary. With the publish date in the visible column the list
 * read as broken -- 2026, then 2011, then 2012 -- so the two now agree, and the
 * 更新时间 order stays available for "what did I just edit", showing the update
 * date while it is active.
 */
export default async function LatestArticlesPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;
  const byUpdated = params.sort === "updated";

  const [result, categories] = await Promise.all([
    searchArticles({
      category: params.category,
      status: params.unpublished ? "draft" : undefined,
      sort: byUpdated ? "updated" : "published",
      page: 1,
      pageSize: 100
    }),
    listCategories(user.email)
  ]);

  const chipHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value && key !== "msg") next.set(key, value);
    }
    const query = next.toString();
    return `/admin/articles/latest${query ? `?${query}` : ""}`;
  };

  return (
    <AdminShell user={user}>
      <ArticleTabs active="latest" />

      {params.msg ? (
        <section className="admin-card" style={{ background: "#f0fbf4", borderColor: "#bfe6cd" }}>
          <strong>{params.msg}</strong>
        </section>
      ) : null}

      <section className="admin-card">
        <p className="muted" style={{ margin: "0 0 10px" }}>
          {byUpdated ? (
            <>
              按<b>更新时间</b>倒序，最近改动过的在最前。注意：15,514 篇迁移文章的更新时间来自导入那几分钟，
              彼此几乎相同，所以这个顺序只对导入后编辑过的文章有意义。
            </>
          ) : (
            <>
              按<b>发布时间</b>倒序，最新发表的在最前。
            </>
          )}
          需要更早的文章请用<Link href="/admin/articles">「查找与修改」</Link>。
        </p>
        <div className="admin-toolbar" style={{ margin: 0 }}>
          <span className="article-chips">
            <Link className={`article-chip${params.category ? "" : " is-on"}`} href={chipHref({ category: undefined })}>
              全部
            </Link>
            {categories
              .filter((c) => c.articleCount > 0)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={chipHref({ category: params.category === c.slug ? undefined : c.slug })}
                  className={`article-chip${params.category === c.slug ? " is-on" : ""}`}
                >
                  {c.name}
                </Link>
              ))}
          </span>
          <Link
            className={`admin-btn admin-btn-sm${params.unpublished ? " admin-btn-primary" : ""}`}
            href={chipHref({ unpublished: params.unpublished ? undefined : "1" })}
            style={{ marginLeft: "auto" }}
          >
            只看未发布
          </Link>
          <Link
            className={`admin-btn admin-btn-sm${byUpdated ? " admin-btn-primary" : ""}`}
            href={chipHref({ sort: byUpdated ? undefined : "updated" })}
          >
            按更新时间
          </Link>
        </div>
      </section>

      <section className="admin-card">
        <form id="bulk-form" method="post" action="/api/admin/content/articles/bulk" className="admin-toolbar">
          <input type="hidden" name="back" value={chipHref({})} />
          <select className="admin-select" name="action" defaultValue="category">
            <option value="category">改主分类为…</option>
            <option value="publish">发布</option>
            <option value="draft">退回草稿</option>
            <option value="archive">归档</option>
          </select>
          <select className="admin-select" name="category" defaultValue="">
            <option value="">（选择目标分类）</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="admin-btn" type="submit">
            对选中的文章执行
          </button>
        </form>
        <ArticleTable rows={result.rows} numbered dateColumn={byUpdated ? "updated" : "published"} />
        <p className="muted" style={{ margin: "12px 0 0" }}>
          显示 {result.rows.length} 篇，全站共 {result.total.toLocaleString()} 篇
        </p>
      </section>
    </AdminShell>
  );
}
