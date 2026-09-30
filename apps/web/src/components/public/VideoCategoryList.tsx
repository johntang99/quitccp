import type { PublicVideoCategory } from "@/lib/public-content";

function duration(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * One video category's listing page.
 *
 * Cards rather than a table: a video is its thumbnail first. Where a cover is
 * missing the card keeps the same 16:9 box so the grid does not go ragged --
 * only 593 of the 745 have one.
 */
export function VideoCategoryList({
  category,
  siblings
}: {
  category: PublicVideoCategory;
  siblings: { slug: string; name: string; total: number }[];
}) {
  return (
    <main className="wrap" style={{ padding: "34px 0 72px" }}>
      <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", display: "flex", gap: 8 }}>
        <a href="/" style={{ color: "var(--muted)" }}>首页</a>
        <span>/</span>
        <a href="/videos" style={{ color: "var(--muted)" }}>视频</a>
        <span>/</span>
        <span>{category.name}</span>
      </p>

      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 900,
          fontSize: "clamp(26px,3.2vw,38px)",
          margin: "12px 0 6px"
        }}
      >
        {category.name}
      </h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", margin: "0 0 22px" }}>
        共 {category.total.toLocaleString("zh-CN")} 个 · 第 {category.page}／{category.pageCount} 页
      </p>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 26px" }}>
        {siblings.map((sibling) => (
          <a
            key={sibling.slug}
            href={`/videos/${sibling.slug}`}
            style={{
              fontSize: 13,
              padding: "5px 11px",
              borderRadius: 14,
              border: "1px solid var(--line, #ddd)",
              color: sibling.slug === category.slug ? "#fff" : "inherit",
              background: sibling.slug === category.slug ? "#4a3c96" : "transparent",
              textDecoration: "none"
            }}
          >
            {sibling.name}
            <span style={{ opacity: 0.6 }}> {sibling.total}</span>
          </a>
        ))}
      </nav>

      {category.videos.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>这个栏目还没有内容。</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 22
          }}
        >
          {category.videos.map((video) => (
            <article key={video.slug}>
              <a href={`/videos/${encodeURIComponent(video.slug)}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ position: "relative", background: "#E4E1D8", aspectRatio: "16 / 9", overflow: "hidden" }}>
                  {video.coverImage ? (
                    <img
                      src={video.coverImage}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                  {video.durationSeconds ? (
                    <span
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 6,
                        background: "rgba(0,0,0,.78)",
                        color: "#fff",
                        fontSize: 11,
                        padding: "1px 5px",
                        borderRadius: 2
                      }}
                    >
                      {duration(video.durationSeconds)}
                    </span>
                  ) : null}
                </div>
                <h2 style={{ fontSize: 15, lineHeight: 1.6, margin: "10px 0 4px", fontWeight: 700 }}>
                  {video.title}
                </h2>
              </a>
              <p style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
                {[video.episode, video.publishedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 30, fontSize: 14 }}>
        {category.page > 1 ? <a href={`/videos/${category.slug}?page=${category.page - 1}`}>← 上一页</a> : null}
        {category.page < category.pageCount ? (
          <a href={`/videos/${category.slug}?page=${category.page + 1}`}>下一页 →</a>
        ) : null}
      </div>
    </main>
  );
}
