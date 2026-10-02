import Link from "next/link";
import { InteriorHead, InteriorTabs } from "@/components/templates/InteriorScaffold";
import { CULTURE_FILTERS, type CultureListing } from "@/lib/public-content";

/**
 * 中华传统文化 — the article archive, read from the article library.
 *
 * What this replaces: ten rows hand-stored in `pages/resources-culture.json`,
 * leaving 304 of 314 published articles unreachable; a pager claiming 68 pages
 * that all returned the same ten; filters implemented by matching titles
 * against hardcoded names, with 良言善语 quietly returning 诗词 articles; and a
 * sidebar whose counts added up to 750.
 *
 * Everything shown here is now counted or queried, so the page cannot disagree
 * with the library behind it.
 */

/** Pages to show around the current one, so a 32-page archive stays usable. */
function pageWindow(current: number, total: number): number[] {
  const span = new Set<number>([1, total, current, current - 1, current + 1]);
  return Array.from(span)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
}

export function CulturePage({
  title,
  subtitle,
  listing,
  activeFilter,
  freeUse,
  related
}: {
  title: string;
  subtitle: string;
  listing: CultureListing;
  activeFilter: string;
  freeUse?: { title: string; body: string; buttonLabel: string; buttonHref: string };
  related?: { title: string; links: { label: string; href: string }[] };
}) {
  const href = (filterKey: string, page = 1) => {
    const params = new URLSearchParams();
    if (filterKey !== "all") params.set("filter", filterKey);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/resources/culture${query ? `?${query}` : ""}`;
  };

  const countFor = (key: string) =>
    key === "all" ? listing.counts.all
    : key === "poetry" ? listing.counts.poetry
    : key === "music" ? listing.counts.music
    : listing.counts.article;

  const pages = pageWindow(listing.page, listing.pageCount);

  return (
    <>
      <InteriorHead section="resources" slug="culture" title={title} subtitle={subtitle} />
      <InteriorTabs section="resources" slug="culture" />
      <section className="sec" style={{ paddingTop: 52 }}>
        <div className="wrap cols">
          <article>
            <div className="filters">
              {CULTURE_FILTERS.map((filter) => (
                <Link
                  key={filter.key}
                  className={filter.key === activeFilter ? "chip on" : "chip"}
                  href={href(filter.key)}
                >
                  {filter.label}
                  {/* The count is the point: it is what the old chips lied about. */}
                  <em style={{ fontStyle: "normal", opacity: 0.6, marginLeft: 6 }}>{countFor(filter.key)}</em>
                </Link>
              ))}
            </div>

            <p className="meta" style={{ margin: "0 0 18px" }}>
              共 {listing.total} 篇 · 第 {listing.page} / {listing.pageCount} 页
            </p>

            <div className="arch">
              {listing.rows.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>这个分类下还没有文章。</p>
              ) : (
                listing.rows.map((row) => (
                  <article key={row.slug} className="arow">
                    <Link href={`/news/${encodeURIComponent(row.slug)}`} style={{ display: "contents" }}>
                      {row.image ? <img src={row.image} alt="" /> : <span />}
                      <div>
                        <span className="tag">{row.tag}</span>
                        <h3>{row.title}</h3>
                        {row.summary ? <p>{row.summary}</p> : null}
                        <p className="meta">{row.date}</p>
                      </div>
                    </Link>
                  </article>
                ))
              )}
            </div>

            {listing.pageCount > 1 ? (
              <div className="pager">
                {pages.map((page, index) => (
                  <span key={page} style={{ display: "contents" }}>
                    {index > 0 && page - pages[index - 1] > 1 ? <span className="pager-gap">…</span> : null}
                    <Link className={page === listing.page ? "on" : ""} href={href(activeFilter, page)}>
                      {page}
                    </Link>
                  </span>
                ))}
                {listing.page < listing.pageCount ? (
                  <Link href={href(activeFilter, listing.page + 1)}>下一页 →</Link>
                ) : null}
              </div>
            ) : null}
          </article>

          <aside className="side">
            <div className="panel">
              <h4>分类</h4>
              <ul>
                {CULTURE_FILTERS.filter((f) => f.key !== "all").map((filter) => (
                  <li key={filter.key}>
                    <Link href={href(filter.key)}>
                      {filter.label}
                      <em style={{ fontStyle: "normal", color: "var(--muted)", float: "right" }}>
                        {countFor(filter.key)}
                      </em>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {freeUse ? (
              <div className="panel panel--seal">
                <h4>{freeUse.title}</h4>
                <p>{freeUse.body}</p>
                <Link className="btn btn--line-light btn--sm" href={freeUse.buttonHref}>
                  {freeUse.buttonLabel}
                </Link>
              </div>
            ) : null}

            {related && related.links.length > 0 ? (
              <div className="panel">
                <h4>{related.title}</h4>
                <ul>
                  {related.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}
