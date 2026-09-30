import type { NewsListing } from "@/lib/public-content";
import { NewsHeader } from "./NewsHeader";
import { T, day } from "./newsTokens";

const href = (slug: string) => `/news/${encodeURIComponent(slug)}`;

/**
 * A category's own page: the same card language as the landing grid, at length.
 *
 * The first article keeps the lead treatment so the page has a top, and the
 * rest run as a dated list -- the shape readers have just come from.
 */
export function NewsListingPage({ listing }: { listing: NewsListing }) {
  const [lead, ...rest] = listing.items;
  const pageHref = (page: number) =>
    `/news/${listing.slug}${page > 1 ? `?page=${page}` : ""}`;

  return (
    <div className="news-page">
      <NewsHeader active={listing.slug} />
      <div className="news-shell news-body">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: T.serif, fontWeight: 900, fontSize: 32 }}>{listing.name}</span>
          <span style={{ flexGrow: 1, height: 1, background: T.ink }} aria-hidden="true" />
          <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.2em", color: T.muted }}>
            {listing.total.toLocaleString("zh-CN")} 篇
          </span>
        </div>

        {listing.items.length === 0 ? (
          <p style={{ color: T.muted }}>这个栏目还没有文章。</p>
        ) : (
          <>
            {lead ? (
              <a
                href={href(lead.slug)}
                className="news-featured-grid"
                style={{ color: T.ink, textDecoration: "none", alignItems: "center" }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: 6,
                    overflow: "hidden",
                    background: T.rule,
                    boxShadow: "0 24px 48px -32px rgba(26,23,38,0.45)"
                  }}
                >
                  {lead.image ? (
                    <img src={lead.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                    {day(lead.publishedAt)}
                  </span>
                  <h2 style={{ margin: 0, fontFamily: T.serif, fontWeight: 900, fontSize: 30, lineHeight: 1.4 }}>
                    {lead.title}
                  </h2>
                  {lead.summary ? (
                    <p
                      style={{
                        margin: 0,
                        fontFamily: T.serif,
                        fontSize: 16,
                        lineHeight: 1.9,
                        color: T.body,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}
                    >
                      {lead.summary}
                    </p>
                  ) : null}
                  <span style={{ fontSize: 14, color: T.seal }}>阅读全文 →</span>
                </div>
              </a>
            ) : null}

            <div className="news-cat-grid">
              {rest.map((item) => (
                <a
                  key={item.slug}
                  href={href(item.slug)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "96px minmax(0, 1fr)",
                    gap: 20,
                    alignItems: "baseline",
                    padding: "20px 0",
                    borderTop: `1px solid ${T.ruleSoft}`,
                    color: T.ink,
                    textDecoration: "none"
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                    {day(item.publishedAt)}
                  </span>
                  <span
                    style={{
                      fontFamily: T.serif,
                      fontWeight: 600,
                      fontSize: 20,
                      lineHeight: 1.55,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}
                  >
                    {item.title}
                  </span>
                </a>
              ))}
            </div>

            {listing.pageCount > 1 ? (
              <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 14 }}>
                {listing.page > 1 ? <a href={pageHref(listing.page - 1)}>← 上一页</a> : null}
                <span style={{ fontFamily: T.mono, color: T.muted }}>
                  {listing.page} / {listing.pageCount}
                </span>
                {listing.page < listing.pageCount ? <a href={pageHref(listing.page + 1)}>下一页 →</a> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
