import { NEWS_CATEGORIES, type NewsCard, type NewsListing, type NewsSort } from "@/lib/public-content";
import { NewsHeader } from "./NewsHeader";
import { T, articleHref, day } from "./newsTokens";
import { NewsRow } from "./NewsRow";
import { NewsInfiniteRows } from "./NewsInfiniteRows";
import { NEWS_MAX_CHUNK } from "./newsChunks";

/**
 * A listing page: one category, or one of the section-wide scopes
 * (全部文章 / 最新发布 / 重要报导 / 精彩保留).
 *
 * Implements `docs/prototypes/news/news-category-display-html`: a gradient
 * masthead, a lead card lifted over its lower edge, then the list beside a
 * sidebar. The masthead is the section's own <NewsHeader>, so the category tab
 * row stays put and a reader can move between categories from inside one.
 */
export function NewsListingPage({ listing }: { listing: NewsListing }) {
  const [lead, ...rest] = listing.items;
  /* Page one in the default order is `/news/<slug>` and nothing else -- no
     query string, no trailing number. That address is the one readers hold and
     the one that has to be cacheable, so it must not carry anything the server
     would have to read. Everything deeper goes to /news/<slug>/<page>, a route
     of its own that may be dynamic. */
  const href = (page: number, sort: NewsSort = listing.sort) => {
    const base = `/news/${listing.slug}`;
    if (page <= 1 && sort === "latest") return base;
    return `${base}/${Math.max(page, 1)}${sort === "latest" ? "" : `?sort=${sort}`}`;
  };
  // The lead treatment belongs to the first article of the first page. Deeper in
  // the listing nothing is "本栏头条", so every row runs as an ordinary card.
  const showLead = Boolean(lead) && listing.page === 1;
  const rows = showLead ? rest : listing.items;
  /* See the note beside <NewsInfiniteRows>. */
  const scrolls = listing.page === 1 && listing.sort === "latest" && listing.pageCount > 1;

  return (
    <div className="news-page">
      {/* The section masthead, with this listing's identity in place of the
          section title and its tab row intact -- every category visible, this
          one marked. */}
      <NewsHeader
        active={listing.slug}
        listing={{ name: listing.name, en: listing.en, total: listing.total, description: listing.description }}
      />

      {showLead && lead ? (
        <div className="news-shell news-cat-lift">
          <a className="news-cat-lead" href={articleHref(lead.slug)}>
            <span style={{ position: "relative", display: "block", background: T.rule }}>
              {lead.image ? (
                <img
                  src={lead.image}
                  alt=""
                  style={{ width: "100%", aspectRatio: "16 / 9", height: "auto", objectFit: "cover", display: "block" }}
                />
              ) : (
                <span style={{ display: "block", width: "100%", aspectRatio: "16 / 9" }} />
              )}
              <span className="news-cat-flag">本栏头条</span>
            </span>
            <span className="news-cat-lead-body">
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                {lead.category ? (
                  <>
                    <span style={{ color: T.seal, fontWeight: 500 }}>{lead.category}</span>
                    <span style={{ width: 1, height: 11, background: T.divider }} aria-hidden="true" />
                  </>
                ) : null}
                <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>{day(lead.publishedAt)}</span>
              </span>
              <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: "clamp(22px, 2.4vw, 32px)", lineHeight: 1.4 }}>
                {lead.title}
              </span>
              {lead.summary ? (
                <span
                  className="news-clamp-5"
                  style={{ fontFamily: T.serif, fontSize: 15, lineHeight: "var(--lh-body)", color: T.body }}
                >
                  {lead.summary}
                </span>
              ) : null}
              <span
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  color: T.seal
                }}
              >
                阅读全文
                <span className="news-cat-arrow" aria-hidden="true">→</span>
              </span>
            </span>
          </a>
        </div>
      ) : null}

      <div className={`news-shell news-cat-body${showLead ? "" : " news-cat-body--flat"}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="news-cat-bar">
            <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 22 }}>全部文章</span>
            {/* 最新 / 最早. The design's second pill is 最热; nothing counts reads,
                so there is no such order to offer. */}
            <span className="news-cat-sorts">
              <a className="news-cat-sort" data-on={listing.sort === "latest" ? "1" : undefined} href={href(1, "latest")}>
                最新
              </a>
              <a className="news-cat-sort" data-on={listing.sort === "oldest" ? "1" : undefined} href={href(1, "oldest")}>
                最早
              </a>
            </span>
          </div>

          {rows.length === 0 ? (
            <p style={{ color: T.muted, fontSize: 15 }}>
              {listing.total === 0 ? "这个栏目还没有文章。" : "本页文章已全部列于上方。"}
            </p>
          ) : (
            rows.map((item) => <NewsRow key={item.slug} item={item} />)
          )}

          {/*
            Infinite scroll only on the listing's own front page in the default
            order. Deeper pages and 最早 keep plain pagination: those addresses
            are where a reader lands from a link or a bookmark, and a page that
            silently grows under them is not what they asked for.
          */}
          {scrolls ? (
            <NewsInfiniteRows
              slug={listing.slug}
              startPage={1}
              pageCount={listing.pageCount}
              total={listing.total}
              maxChunk={NEWS_MAX_CHUNK}
              /* What is already on the page, so a chunk cannot repeat it. */
              shownSlugs={listing.items.map((item) => item.slug)}
            />
          ) : null}

          {/*
            The pager stays rendered even when the scroll is on. It is the
            fallback for every reader whose JavaScript never arrives -- a large
            share here reach the site through a proxy from inside China -- and
            `data-scrolls` lets CSS fold it away once the scroll takes over.
            Hidden by CSS rather than dropped from the markup, because markup
            that is not there cannot come back when the script fails.
          */}
          {listing.pageCount > 1 ? (
            <div data-news-pager={scrolls ? "scrolls" : undefined}>
              <Pager listing={listing} href={href} />
            </div>
          ) : null}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {listing.picks.length > 0 ? (
            <div className="news-cat-panel">
              {/* 编辑精选, not 本栏最热: these are the 精彩保留 articles the editors
                  flagged. A "most read" rail would need a counter nothing keeps. */}
              <span className="news-cat-panel-head">编辑精选</span>
              {listing.picks.map((item, index) => (
                <a
                  key={item.slug}
                  href={articleHref(item.slug)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px minmax(0, 1fr)",
                    gap: 10,
                    padding: "13px 0",
                    borderBottom: index === listing.picks.length - 1 ? "0" : `1px solid ${T.rule}`,
                    color: T.ink,
                    textDecoration: "none"
                  }}
                >
                  <span style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 20, lineHeight: 1.1, color: T.goldDeep }}>
                    {index + 1}
                  </span>
                  <span style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 15, lineHeight: 1.5 }}>
                    {item.title}
                  </span>
                </a>
              ))}
            </div>
          ) : null}

          <div className="news-cat-panel news-cat-panel--dark">
            <span className="news-cat-panel-head news-cat-panel-head--dark">其他栏目</span>
            {NEWS_CATEGORIES.filter((category) => category.slug !== listing.slug).map((category) => (
              <a key={category.slug} href={`/news/${category.slug}`} className="news-cat-other">
                <span>{category.name}</span>
                <span style={{ color: T.gold }} aria-hidden="true">→</span>
              </a>
            ))}
            {/* The section-wide scopes, so a reader can step back out to them. */}
            {OTHER_SCOPES.filter((scope) => scope.slug !== listing.slug).map((scope) => (
              <a key={scope.slug} href={`/news/${scope.slug}`} className="news-cat-other">
                <span>{scope.name}</span>
                <span style={{ color: T.gold }} aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

const OTHER_SCOPES = [
  { slug: "archive", name: "全部文章" },
  { slug: "featured", name: "重要报导" },
  { slug: "editor-archive", name: "精彩保留" }
];

/** Pages around the current one, with ellipses where a run is skipped. */
function pageNumbers(current: number, count: number): (number | "gap")[] {
  const pages = new Set<number>([1, count, current]);
  for (const offset of [-1, 1]) {
    const near = current + offset;
    if (near > 1 && near < count) pages.add(near);
  }
  const sorted = [...pages].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push("gap");
    out.push(page);
  });
  return out;
}

function Pager({
  listing,
  href
}: {
  listing: NewsListing;
  href: (page: number, sort?: NewsSort) => string;
}) {
  const { page, pageCount, total } = listing;
  return (
    <nav aria-label="分页" className="news-cat-pager">
      <span style={{ fontSize: 13, color: T.muted }}>
        第 {page} / {pageCount} 页 · 共 {total.toLocaleString("zh-CN")} 篇
      </span>
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {page > 1 ? (
          <a className="news-cat-step" href={href(page - 1)} rel="prev">← 上一页</a>
        ) : (
          <span className="news-cat-step" aria-disabled="true" style={{ color: "var(--lav-muted)" }}>← 上一页</span>
        )}
        {pageNumbers(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="news-cat-page" data-gap="1" aria-hidden="true">…</span>
          ) : (
            <a
              key={entry}
              className="news-cat-page"
              data-on={entry === page ? "1" : undefined}
              href={href(entry)}
              aria-current={entry === page ? "page" : undefined}
            >
              {entry}
            </a>
          )
        )}
        {page < pageCount ? (
          <a className="news-cat-next" href={href(page + 1)} rel="next">下一页 →</a>
        ) : null}
      </span>
    </nav>
  );
}
