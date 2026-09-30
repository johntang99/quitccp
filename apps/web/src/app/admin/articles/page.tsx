import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listArticleAuthors, searchArticles, type ArticleSearchFilters } from "@/lib/admin/article-search";
import { listCategories } from "@/lib/admin/repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const GAPS = [
  { key: "no-cover", label: "缺封面图" },
  { key: "no-author", label: "缺作者" },
  { key: "no-summary", label: "缺摘要" }
] as const;

export default async function AdminArticlesPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const filters: ArticleSearchFilters = {
    q: params.q,
    category: params.category,
    status: params.status,
    author: params.author,
    from: params.from,
    to: params.to,
    gap: params.gap as ArticleSearchFilters["gap"],
    sort: (params.sort as ArticleSearchFilters["sort"]) ?? "published",
    featured: params.featured === "1" ? true : undefined,
    editorArchive: params.editorArchive === "1" ? true : undefined,
    page: Number(params.page ?? "1") || 1,
    pageSize: Number(params.pageSize ?? "20") || 20
  };

  const [result, categories, authors] = await Promise.all([
    searchArticles(filters),
    listCategories(user.email),
    listArticleAuthors()
  ]);

  /** Keeps every active filter in the URL, so a filtered view can be shared. */
  const hrefWith = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && key !== "msg") next.set(key, value);
    }
    const query = next.toString();
    return `/admin/articles${query ? `?${query}` : ""}`;
  };
  const currentHref = hrefWith({});
  const hasFilters = Boolean(
    params.q || params.category || params.status || params.author || params.from || params.to || params.gap ||
      params.featured ||
      params.editorArchive
  );

  return (
    <AdminShell user={user}>
      <ArticleTabs active="search" />

      {params.msg ? (
        <section className="admin-card" style={{ background: "#f0fbf4", borderColor: "#bfe6cd" }}>
          <strong>{params.msg}</strong>
        </section>
      ) : null}

      <section className="admin-card">
        <form method="get" className="admin-toolbar" style={{ marginBottom: 10 }}>
          <input
            className="admin-input"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="搜索标题、摘要或 slug"
            style={{ flex: 1, minWidth: 240 }}
          />
          <select className="admin-select" name="category" defaultValue={params.category ?? ""}>
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}（{c.articleCount}）
              </option>
            ))}
          </select>
          <select className="admin-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
          <select className="admin-select" name="author" defaultValue={params.author ?? ""}>
            <option value="">全部作者</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label style={{ color: "#8a90a0", display: "flex", gap: 6, alignItems: "center" }}>
            发布于
            <input className="admin-input" type="date" name="from" defaultValue={params.from ?? ""} />
            至
            <input className="admin-input" type="date" name="to" defaultValue={params.to ?? ""} />
          </label>
          {/* 发布时间 is the default now. Sorting by 更新时间 is still offered, but
              it groups rather than orders: the import stamped 80 articles per
              second, so it cannot tell those 80 apart. */}
          <select className="admin-select" name="sort" defaultValue={params.sort ?? "published"}>
            <option value="published">发布时间（新→旧）</option>
            <option value="updated">更新时间（新→旧）</option>
            <option value="title">标题 A→Z</option>
          </select>
          {params.gap ? <input type="hidden" name="gap" value={params.gap} /> : null}
          {params.featured ? <input type="hidden" name="featured" value={params.featured} /> : null}
          {params.editorArchive ? (
            <input type="hidden" name="editorArchive" value={params.editorArchive} />
          ) : null}
          <button className="admin-btn admin-btn-primary" type="submit">
            搜索
          </button>
        </form>

        <div className="admin-toolbar" style={{ marginBottom: 6 }}>
          <span className="article-chips">
            {/* The two editorial marks sit with the gap chips: both answer
                "show me the subset I care about right now". */}
            <Link
              href={hrefWith({ featured: params.featured ? undefined : "1", page: undefined })}
              className={`article-chip${params.featured ? " is-on" : ""}`}
            >
              ★ 重要
            </Link>
            <Link
              href={hrefWith({ editorArchive: params.editorArchive ? undefined : "1", page: undefined })}
              className={`article-chip${params.editorArchive ? " is-on" : ""}`}
            >
              ✦ 精彩保留
            </Link>
            {GAPS.map((gap) => (
              <Link
                key={gap.key}
                href={hrefWith({ gap: params.gap === gap.key ? undefined : gap.key, page: undefined })}
                className={`article-chip${params.gap === gap.key ? " is-on" : ""}`}
              >
                {gap.label}
              </Link>
            ))}
          </span>
          {hasFilters ? (
            <Link className="admin-btn admin-btn-sm" href="/admin/articles">
              清除全部筛选
            </Link>
          ) : null}
        </div>

        <p className="muted" style={{ margin: 0 }}>
          符合条件 <b>{result.total.toLocaleString()}</b> 篇 · 第 {result.page}／{result.pageCount} 页
        </p>
      </section>

      <section className="admin-card">
        {/* The checkboxes live in the table and reference this form by id, so the
            bulk bar can sit above the rows without wrapping them. */}
        <form id="bulk-form" method="post" action="/api/admin/content/articles/bulk" className="admin-toolbar">
          <input type="hidden" name="back" value={currentHref} />
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
          <span className="muted">勾选左侧复选框后执行；改分类只替换主分类，副分类不动。</span>
        </form>

        <ArticleTable rows={result.rows} />

        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {result.page > 1 ? (
            <Link className="admin-btn" href={hrefWith({ page: String(result.page - 1) })}>
              ← 上一页
            </Link>
          ) : null}
          {result.page < result.pageCount ? (
            <Link className="admin-btn" href={hrefWith({ page: String(result.page + 1) })}>
              下一页 →
            </Link>
          ) : null}
          <span className="muted">
            每页
            {[20, 50, 100].map((size) => (
              <Link
                key={size}
                href={hrefWith({ pageSize: String(size), page: undefined })}
                style={{ marginLeft: 6, fontWeight: result.pageSize === size ? 700 : 400 }}
              >
                {size}
              </Link>
            ))}
          </span>
        </div>
      </section>
    </AdminShell>
  );
}
