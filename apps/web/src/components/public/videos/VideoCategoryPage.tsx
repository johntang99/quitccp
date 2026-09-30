import type { PublicVideoCard, PublicVideoCategory, VideoSort } from "@/lib/public-content";
import { videoCategoryLede } from "@/lib/video-categories";
import { Duration, MONO, Play, SERIF, Still, videoHref } from "./VideoParts";
import { THEME_BOOTSTRAP, VideoThemeToggle } from "./VideoThemeToggle";

/**
 * One series' listing page.
 *
 * Implements `docs/prototypes/videos/video-category-1-html`. Built from the
 * same `.vp` tokens as the section index, so the 背景 switch themes both pages
 * and the two never drift apart in colour.
 *
 * The shape is fixed by the design -- a lead film, three in 接着看, a grid of
 * twelve -- so the page asks for exactly sixteen rows. A category with fewer
 * simply fills less of it; nothing is padded to make the layout look full.
 */
export function VideoCategoryPage({
  category,
  siblings
}: {
  category: PublicVideoCategory;
  siblings: { slug: string; name: string; total: number }[];
}) {
  const [lead, ...rest] = category.videos;
  const side = rest.slice(0, 3);
  const grid = rest.slice(3);
  const firstIndex = (category.page - 1) * category.pageSize + 1;
  const lastIndex = firstIndex + category.videos.length - 1;
  const href = (page: number, sort: VideoSort = category.sort) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (sort !== "latest") params.set("sort", sort);
    const query = params.toString();
    return `/videos/${category.slug}${query ? `?${query}` : ""}`;
  };

  return (
    <div className="vp">
      {/* Applies the remembered background before first paint, the same as the
          section index -- without it a reader who picked 白色 there arrived
          here in 深色 and had to pick again. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      <span className="vp-glow" aria-hidden="true" />

      <header className="vp-head">
        <div className="vp-shell vp-head-inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              <a href="/" style={{ color: "inherit", textDecoration: "none" }}>首页</a>
              <span style={{ opacity: 0.5 }}> / </span>
              <a href="/videos" style={{ color: "inherit", textDecoration: "none" }}>视频</a>
              <span style={{ opacity: 0.5 }}> / </span>
              {category.name}
            </span>
            <VideoThemeToggle />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 900, fontSize: "clamp(30px, 3.6vw, 48px)", color: "var(--title)" }}>
                  {category.name}
                </h1>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--acc)" }}>
                  {category.total} 部 · 第 {category.page} / {category.pageCount} 页
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--muted)", maxWidth: 760 }}>
                {videoCategoryLede(category.slug)}
              </p>
            </div>

            {/* 最新 / 最早 only. The design's third option, 最热, has no data
                behind it -- see VideoSort. */}
            <div className="vp-sorts" role="group" aria-label="排序">
              <a className="vp-sort" data-on={category.sort === "latest" ? "1" : undefined} href={href(1, "latest")}>
                最新
              </a>
              <a className="vp-sort" data-on={category.sort === "oldest" ? "1" : undefined} href={href(1, "oldest")}>
                最早
              </a>
            </div>
          </div>

          <nav aria-label="视频系列" className="vp-chips">
            <a className="vp-chip" href="/videos">全部</a>
            {siblings.map((sibling) => (
              <a
                key={sibling.slug}
                className="vp-chip"
                data-on={sibling.slug === category.slug ? "1" : undefined}
                href={`/videos/${sibling.slug}`}
              >
                {sibling.name}
                <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.65 }}>{sibling.total}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      {lead ? (
        <section className="vp-shell vp-feature">
          <LeadCard card={lead} sort={category.sort} />
          {side.length > 0 ? <UpNext cards={side} /> : null}
        </section>
      ) : null}

      <section className="vp-shell vp-section">
        <div className="vp-cat-head">
          <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: "clamp(20px, 2.2vw, 24px)", color: "var(--title)" }}>
            全部影片
          </span>
          {category.videos.length > 0 ? (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              显示 {firstIndex}–{lastIndex} / {category.total}
            </span>
          ) : null}
        </div>

        {category.videos.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 15 }}>这个栏目还没有内容。</p>
        ) : grid.length > 0 ? (
          <div className="vp-grid-4" style={{ rowGap: 28 }}>
            {grid.map((card) => (
              <GridCard key={card.slug} card={card} />
            ))}
          </div>
        ) : (
          // Fewer than five films in the category: the lead and 接着看 above
          // already show every one of them, so the grid would repeat them.
          <p style={{ color: "var(--muted)", fontSize: 15 }}>本页影片已全部列于上方。</p>
        )}
      </section>

      {category.pageCount > 1 ? <Pager category={category} href={href} /> : <div style={{ height: 88 }} />}
    </div>
  );
}

/** The badge the design puts on a card: its episode, or 上集／下集 from the title. */
function badgeOf(card: PublicVideoCard): string {
  if (card.episode) return card.episode;
  const part = card.title.match(/（(上|下)）\s*$/);
  if (part) return `${part[1]}集`;
  const issue = card.title.match(/第\s*(\d+)\s*期/);
  return issue ? `第${issue[1]}期` : "";
}

const dateOf = (card: PublicVideoCard) => (card.publishedAt ?? "").slice(0, 10);

function LeadCard({ card, sort }: { card: PublicVideoCard; sort: VideoSort }) {
  return (
    <a className="vp-cat-lead" href={videoHref(card.slug)}>
      <Still card={card} radius={14}>
        <span className="vp-cat-lead-scrim" aria-hidden="true" />
        <span className="vp-cat-lead-play" aria-hidden="true">▶</span>
        <span className="vp-cat-lead-foot">
          <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Truthful under either order: newest first makes this the latest,
                oldest first makes it the earliest. */}
            <span className="vp-cat-flag">{sort === "oldest" ? "最早一期" : "最新一期"}</span>
            {dateOf(card) ? (
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#E6E1F8" }}>{dateOf(card)}</span>
            ) : null}
          </span>
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 900,
              fontSize: "clamp(20px, 2.4vw, 32px)",
              lineHeight: 1.4,
              color: "#fff"
            }}
          >
            {card.title}
          </span>
        </span>
      </Still>
    </a>
  );
}

function UpNext({ cards }: { cards: PublicVideoCard[] }) {
  return (
    <div className="vp-cat-next">
      <span
        style={{
          fontFamily: SERIF,
          fontWeight: 900,
          fontSize: 18,
          color: "var(--title)",
          paddingBottom: 12,
          borderBottom: "2px solid var(--title)"
        }}
      >
        接着看
      </span>
      {cards.map((card, index) => (
        <a
          key={card.slug}
          href={videoHref(card.slug)}
          style={{
            display: "grid",
            gridTemplateColumns: "132px minmax(0, 1fr)",
            gap: 14,
            alignItems: "start",
            padding: "14px 0",
            borderBottom: index === cards.length - 1 ? "0" : "1px solid var(--rule)",
            color: "var(--text)",
            textDecoration: "none"
          }}
        >
          <span style={{ position: "relative", display: "block", width: 132 }}>
            <Still card={card} radius={6}>
              <span style={{ position: "absolute", left: 6, bottom: 6 }}>
                <Play size={24} />
              </span>
            </Still>
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="vp-clamp-3" style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15, lineHeight: 1.45 }}>
              {card.title}
            </span>
            {dateOf(card) ? (
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--muted)" }}>{dateOf(card)}</span>
            ) : null}
          </span>
        </a>
      ))}
    </div>
  );
}

function GridCard({ card }: { card: PublicVideoCard }) {
  const badge = badgeOf(card);
  return (
    <a className="vp-cat-card" href={videoHref(card.slug)}>
      <Still card={card} radius={0}>
        <span style={{ position: "absolute", right: 10, bottom: 10 }}>
          <Play size={34} />
        </span>
        <Duration card={card} />
        {badge ? <span className="vp-cat-flag vp-cat-card-flag">{badge}</span> : null}
      </Still>
      <span style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px 16px", flexGrow: 1 }}>
        <span
          className="vp-clamp-2"
          style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.5, minHeight: 48 }}
        >
          {card.title}
        </span>
        {dateOf(card) ? (
          <span style={{ marginTop: "auto", fontFamily: MONO, fontSize: 11, color: "var(--muted)" }}>
            {dateOf(card)}
          </span>
        ) : null}
      </span>
    </a>
  );
}

/**
 * Page numbers around the current one, with ellipses where a run is skipped.
 *
 * Built from the real page count rather than the mockup's fixed 1 2 3 … 11.
 */
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
  category,
  href
}: {
  category: PublicVideoCategory;
  href: (page: number, sort?: VideoSort) => string;
}) {
  const { page, pageCount, total } = category;
  return (
    <nav aria-label="分页" className="vp-shell vp-cat-pager-wrap">
      <div className="vp-cat-pager">
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          第 {page} / {pageCount} 页 · 共 {total} 部
        </span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {page > 1 ? (
            <a className="vp-cat-step" href={href(page - 1)} rel="prev">← 上一页</a>
          ) : (
            <span className="vp-cat-step" aria-disabled="true" style={{ opacity: 0.45 }}>← 上一页</span>
          )}
          {pageNumbers(page, pageCount).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="vp-cat-page" data-gap="1" aria-hidden="true">…</span>
            ) : (
              <a
                key={entry}
                className="vp-cat-page"
                data-on={entry === page ? "1" : undefined}
                href={href(entry)}
                aria-current={entry === page ? "page" : undefined}
              >
                {entry}
              </a>
            )
          )}
          {page < pageCount ? (
            <a className="vp-cat-next-page" href={href(page + 1)} rel="next">下一页 →</a>
          ) : null}
        </span>
      </div>
    </nav>
  );
}
