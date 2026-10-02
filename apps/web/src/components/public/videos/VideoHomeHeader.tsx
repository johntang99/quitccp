import type { VideoLibraryShelf } from "@/lib/public-content";
import { SERIF } from "./VideoParts";
import { VideoThemeToggle } from "./VideoThemeToggle";

/** The masthead: breadcrumb, background switch, title, search and series chips. */
export function VideoHomeHeader({ shelves }: { shelves: VideoLibraryShelf[] }) {
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
            <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(30px, 3.6vw, 48px)", color: "var(--title)" }}>
              影音节目
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: "var(--lh-body)", color: "var(--muted)", maxWidth: 720 }}>
              现场纪录、当事人访谈、调查影像与系列专题。全部节目可自由下载、转载与再制作。
            </p>
          </div>
        </div>

        {/* 视频首页 is this page; 全部视频 at the far end is the whole library.
            They used to be one chip called 全部, which named both. */}
        <nav aria-label="视频系列" className="vp-chips">
          <a className="vp-chip" data-on="1" href="/videos">
            视频首页
          </a>
          {shelves.map((shelf) => (
            <a key={shelf.slug} className="vp-chip" href={`/videos/${shelf.slug}`}>
              {shelf.name}
            </a>
          ))}
          <a className="vp-chip" href="/videos/archive">
            全部视频
          </a>
        </nav>
      </div>
    </header>
  );
}
