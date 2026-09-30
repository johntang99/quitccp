import type { VideoLibraryShelf } from "@/lib/public-content";

function duration(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The video library front page, one shelf per category.
 *
 * Every shelf and every card is real. Categories with nothing in them are left
 * out rather than shown empty -- three of the eight have almost no content, and
 * an empty shelf reads as a broken page.
 */
export function VideoLibraryIndex({ shelves }: { shelves: VideoLibraryShelf[] }) {
  const total = shelves.reduce((sum, shelf) => sum + shelf.total, 0);

  return (
    <main className="wrap" style={{ padding: "34px 0 72px" }}>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 900,
          fontSize: "clamp(26px,3.4vw,40px)",
          margin: "0 0 8px"
        }}
      >
        影音库
      </h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", margin: "0 0 34px" }}>
        共 {total.toLocaleString("zh-CN")} 个节目 · {shelves.length} 个系列
      </p>

      {shelves.map((shelf) => (
        <section key={shelf.slug} style={{ marginBottom: 44 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, margin: 0 }}>
              {shelf.name}
            </h2>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
              {shelf.total}
            </span>
            <a href={`/videos/${shelf.slug}`} style={{ marginLeft: "auto", fontSize: 13 }}>
              查看全部 →
            </a>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 18
            }}
          >
            {shelf.videos.map((video) => (
              <a
                key={video.slug}
                href={`/videos/${encodeURIComponent(video.slug)}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
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
                <h3 style={{ fontSize: 14, lineHeight: 1.6, margin: "9px 0 3px", fontWeight: 700 }}>
                  {video.title}
                </h3>
                <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
                  {[video.episode, video.publishedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                </p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
