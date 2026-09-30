import type { VideoLibraryShelf } from "@/lib/public-content";
import { SERIF, MONO } from "./VideoParts";
import { VideoThemeToggle } from "./VideoThemeToggle";

/** The masthead: breadcrumb, background switch, title, search and series chips. */
export function VideoHomeHeader({ shelves, total }: { shelves: VideoLibraryShelf[]; total: number }) {
  return (
    <header className="vp-head">
      <div className="vp-shell vp-head-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>首页</a>
            <span style={{ opacity: 0.5 }}> / </span>视频
          </span>
          <VideoThemeToggle />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 900, fontSize: "clamp(30px, 3.6vw, 48px)", color: "var(--title)" }}>
              影音节目
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--muted)", maxWidth: 720 }}>
              现场纪录、当事人访谈、调查影像与系列专题。全部节目可自由下载、转载与再制作。
            </p>
          </div>
          <a
            href="/search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: 320,
              padding: "12px 16px",
              borderRadius: 999,
              background: "var(--field)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              fontSize: 14,
              textDecoration: "none"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            搜索节目、系列或人物
          </a>
        </div>

        <nav aria-label="视频系列" className="vp-chips">
          <a className="vp-chip" data-on="1" href="/videos">
            全部
            <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.65 }}>{total}</span>
          </a>
          {shelves.map((shelf) => (
            <a key={shelf.slug} className="vp-chip" href={`/videos/${shelf.slug}`}>
              {shelf.name}
              <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.65 }}>{shelf.total}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
