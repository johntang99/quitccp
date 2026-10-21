import Link from "next/link";
import { after } from "next/server";
import type { Route } from "next";
import { searchPublishedArticlesWithMeta, type SearchArticleResult } from "@/lib/search-repository";
import type { SearchResultType } from "@/lib/search-substring";
import { SearchHighlight } from "@/components/public/SearchHighlight";
import { recordSearchMiss } from "@/lib/search-misses";
import { SITE_LOCALE } from "@/lib/site-config";
import { t } from "@/lib/i18n";

/**
 * A full-text scan over 120MB of prose can take the better part of a minute for
 * a rare two-character term, and returning the result matters more than
 * returning quickly. Vercel's default would cut that off well before the
 * database does.
 */
export const maxDuration = 60;

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
  { key: "all", label: t("search.tab.all") },
  { key: "article", label: t("search.tab.article") },
  { key: "video", label: t("search.tab.video") },
  { key: "material", label: t("search.tab.material") }
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

  const execution = query
    ? await searchPublishedArticlesWithMeta(query, { locale: SITE_LOCALE, limit: MAX_RESULTS })
    : null;
  const all = execution?.results ?? [];
  // The search gave up on the slow tier partway. Saying 没有匹配结果 here would
  // be a wrong answer, not a slow one.
  const incomplete = execution?.meta.truncated ?? false;

  /*
   * Note what the archive could not answer.
   *
   * Only genuine misses: a search cut short by the database found nothing
   * because it stopped looking, which says nothing about missing content and
   * would fill the table with noise.
   *
   * Inside `after()`, so it runs once the reader already has the page. Recording
   * a miss must not add a millisecond to the search that missed, and must never
   * be able to fail it.
   */
  if (query && all.length === 0 && !incomplete) {
    after(() => recordSearchMiss(query));
  }

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
            <Link href="/">{t("search.home")}</Link>
            <span>/</span>
            <span>{t("search.crumb")}</span>
          </p>
          <h1>{t("search.title")}</h1>
          <p className="sub">
            {t("search.keyword", { q: query || t("search.noKeyword") })}
            {/* The count is what is actually being shown. When the ceiling was
                hit it says so rather than appending a "+", which read as "3+
                materials" on a filtered view and meant nothing to anybody. */}
            {query
              ? capped
            ? t("search.countCapped", { n: ordered.length, max: MAX_RESULTS })
            : t("search.count", { n: ordered.length })
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
                    {t("search.byRelevance")}
                  </Link>
                  <Link
                    className={sort === "date" ? "chip on" : "chip"}
                    href={searchHref({ q: query, type, sort: "date" })}
                  >
                    {t("search.byNewest")}
                  </Link>
                </div>
              </div>
            ) : null}

            {rows.length === 0 ? (
              <p>
                {!query
                  ? t("search.promptEmpty")
                  : incomplete
                    ? t("search.timeout")
                    : t("search.noResults")}
              </p>
            ) : (
              <div className="arch">
                {rows.map((item) => (
                  <article
                    key={item.id}
                    className={item.image ? "arow" : "arow arow--noimg"}
                  >
                    {/* No image means no column for one. The empty grey box that
                        used to sit here regardless was a prototype placeholder
                        that read as a picture which had failed to load. */}
                    {item.image ? (
                      <div className="athumb">
                        <img src={item.image} alt="" loading="lazy" decoding="async" />
                      </div>
                    ) : null}
                    <div>
                      <p className="meta">
                        {item.typeLabel}
                        {formatDate(item.publishedAt) ? ` · ${formatDate(item.publishedAt)}` : ""}
                      </p>
                      <h3>
                        <Link href={item.href as Route}>
                          <SearchHighlight text={item.title} query={query} />
                        </Link>
                      </h3>
                      {item.excerpt ? (
                        <p>
                          <SearchHighlight text={item.excerpt} query={query} />
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {pageCount > 1 ? (
              <nav className="pager" aria-label={t("search.aria.pager")}>
                {current > 1 ? (
                  <Link href={searchHref({ q: query, sort, type, page: current - 1 })}>
                    {t("search.prev")}
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
                    {t("search.next")}
                  </Link>
                ) : null}
              </nav>
            ) : null}

            {capped ? (
              <p className="muted" style={{ marginTop: 16 }}>
                {t("search.narrowHint")}
              </p>
            ) : null}
            {incomplete && rows.length > 0 ? (
              <p className="muted" style={{ marginTop: 16 }}>
                {t("search.partialHint")}
              </p>
            ) : null}
          </article>
          <aside className="side">
            <section className="panel">
              <h4>{t("search.helpTitle")}</h4>
              <ul>
                <li>{t("search.helpTwoWords")}</li>
                <li>{t("search.helpVariants")}</li>
                <li>{t("search.helpRelevance")}</li>
              </ul>
            </section>
            <section className="panel">
              <h4>{t("search.declareTitle")}</h4>
              <p>{t("search.declareBody")}</p>
              <ul>
                <li>
                  <a href="https://santui.tuidang.org/search" target="_blank" rel="noopener noreferrer">
                    {t("search.declareLookup")}
                  </a>
                </li>
                <li>
                  <a
                    href="https://service.tuidang.org/cert-verify/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("search.certVerify")}
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
