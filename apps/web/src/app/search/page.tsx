import Link from "next/link";
import type { Route } from "next";
import { searchPublishedArticles, type SearchArticleResult } from "@/lib/search-repository";
import type { SearchResultType } from "@/lib/search-substring";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; type?: string }>;
}

/**
 * How many results are fetched before paging.
 *
 * Search asks the backend once and pages in memory. A reader who has gone past
 * ten pages is not reading, they are trying to narrow something down, and the
 * honest response is to say so rather than to let them walk through two thousand
 * articles twenty at a time. The count shown says when this ceiling was reached.
 */
const MAX_RESULTS = 200;
const PAGE_SIZE = 20;

const TYPE_TABS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "article", label: "新闻与报告" },
  { key: "video", label: "视频" },
  { key: "material", label: "资料" }
];

function formatDate(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Preserves the other parameters when one of them changes. */
function searchHref(params: Record<string, string | number | undefined>): Route {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all" || value === 1) continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return (suffix ? `/search?${suffix}` : "/search") as Route;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = resolved.q?.trim() ?? "";
  const sort = resolved.sort === "date" ? "date" : "relevance";
  const type = TYPE_TABS.some((tab) => tab.key === resolved.type) ? resolved.type! : "all";
  const page = Math.max(1, Number(resolved.page ?? "1") || 1);

  const all = query
    ? await searchPublishedArticles(query, { locale: "zh", limit: MAX_RESULTS })
    : [];

  const filtered: SearchArticleResult[] =
    type === "all" ? all : all.filter((row) => row.type === (type as SearchResultType));

  // The backend already returns relevance order -- title matches first, then
  // summary, then body, newest first inside each band. Sorting by date throws
  // that away deliberately, which is what someone asking for 最新 wants.
  const ordered =
    sort === "date"
      ? [...filtered].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      : filtered;

  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = ordered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const capped = all.length >= MAX_RESULTS;

  const countByType = (key: string) =>
    key === "all" ? all.length : all.filter((row) => row.type === key).length;

  return (
    <>
      <section className="phead phead--slim">
        <div className="wrap">
          <p className="crumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>搜索</span>
          </p>
          <h1>搜索结果</h1>
          <p className="sub">
            关键词：{query || "（未输入）"}
            {/* The count is what is actually being shown. When the ceiling was
                hit it says so rather than appending a "+", which read as "3+
                materials" on a filtered view and meant nothing to anybody. */}
            {query
              ? `　共 ${ordered.length} 条${capped ? `（匹配更多，仅显示前 ${MAX_RESULTS} 条）` : ""}`
              : ""}
          </p>
        </div>
      </section>
      <section className="sec">
        <div className="wrap cols">
          <article>
            {query ? (
              <div className="search-controls">
                <div className="filters">
                  {TYPE_TABS.map((tab) => {
                    const n = countByType(tab.key);
                    return (
                      <Link
                        key={tab.key}
                        className={tab.key === type ? "chip on" : "chip"}
                        href={searchHref({ q: query, sort, type: tab.key })}
                      >
                        {/* The count shows even at zero, so an empty category
                            is visible as empty rather than as a tab that leads
                            nowhere. */}
                        {tab.label}
                        {`（${n}）`}
                      </Link>
                    );
                  })}
                </div>
                <div className="search-sort">
                  <Link
                    className={sort === "relevance" ? "chip on" : "chip"}
                    href={searchHref({ q: query, type })}
                  >
                    按相关度
                  </Link>
                  <Link
                    className={sort === "date" ? "chip on" : "chip"}
                    href={searchHref({ q: query, type, sort: "date" })}
                  >
                    最新优先
                  </Link>
                </div>
              </div>
            ) : null}

            {rows.length === 0 ? (
              <p>{query ? "没有匹配结果。" : "请输入关键词。"}</p>
            ) : (
              <div className="arch">
                {rows.map((item) => (
                  <article key={item.id} className="arow">
                    <div className="athumb">
                      <div className="sectionCard" />
                    </div>
                    <div>
                      <p className="meta">
                        {item.typeLabel}
                        {formatDate(item.publishedAt) ? ` · ${formatDate(item.publishedAt)}` : ""}
                      </p>
                      <h3>
                        <Link href={item.href as Route}>{item.title}</Link>
                      </h3>
                      {item.excerpt ? <p>{item.excerpt}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {pageCount > 1 ? (
              <nav className="pager" aria-label="搜索结果分页">
                {current > 1 ? (
                  <Link href={searchHref({ q: query, sort, type, page: current - 1 })}>
                    ← 上一页
                  </Link>
                ) : null}
                {Array.from({ length: pageCount }, (_, index) => index + 1)
                  // Long result sets get the first, last and a window around the
                  // current page rather than forty numbered links.
                  .filter(
                    (n) => n === 1 || n === pageCount || Math.abs(n - current) <= 2
                  )
                  .map((n, index, visible) => (
                    <span key={n}>
                      {index > 0 && n - visible[index - 1] > 1 ? <a aria-hidden>…</a> : null}
                      <Link
                        className={n === current ? "on" : undefined}
                        href={searchHref({ q: query, sort, type, page: n })}
                      >
                        {n}
                      </Link>
                    </span>
                  ))}
                {current < pageCount ? (
                  <Link href={searchHref({ q: query, sort, type, page: current + 1 })}>
                    下一页 →
                  </Link>
                ) : null}
              </nav>
            ) : null}

            {capped ? (
              <p className="muted" style={{ marginTop: 16 }}>
                换用更具体的关键词，或再加一个词缩小范围，例如「三退 义工」。
              </p>
            ) : null}
          </article>
          <aside className="side">
            <section className="panel">
              <h4>搜索说明</h4>
              <ul>
                <li>可以用两个词，例如「法轮功 迫害」</li>
                <li>繁体、简体都可以，结果一样</li>
                <li>默认按相关度：标题命中的排在前面</li>
              </ul>
            </section>
            <section className="panel">
              <h4>查询三退声明</h4>
              <p>声明与退党证明不在本站搜索范围内，请前往：</p>
              <ul>
                <li>
                  <a href="https://santui.tuidang.org/search" target="_blank" rel="noopener noreferrer">
                    声明查询 ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://service.tuidang.org/cert-verify/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    退党证明验证 ↗
                  </a>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
