import type { VideoLibraryShelf } from "@/lib/public-content";
import { SERIF } from "./VideoParts";
import { VideoThemeToggle } from "./VideoThemeToggle";
import { t } from "@/lib/i18n";

/** The masthead: breadcrumb, background switch, title, search and series chips. */
export function VideoHomeHeader({ shelves }: { shelves: VideoLibraryShelf[] }) {
  return (
    <header className="vp-head">
      <div className="vp-shell vp-head-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>{t("video.home")}</a>
            <span style={{ opacity: 0.5 }}> / </span>{t("video.videos")}
          </span>
          <VideoThemeToggle />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(30px, 3.6vw, 48px)", color: "var(--title)" }}>
              {t("video.programmesTitle")}
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: "var(--lh-body)", color: "var(--muted)", maxWidth: 720 }}>
              {t("video.programmesIntro")}
            </p>
          </div>
        </div>

        {/* 视频首页 is this page; 全部视频 at the far end is the whole library.
            They used to be one chip called 全部, which named both. */}
        <nav aria-label={t("video.aria.series")} className="vp-chips">
          <a className="vp-chip" data-on="1" href="/videos">
            {t("video.allVideos")}
          </a>
          {shelves.map((shelf) => (
            <a key={shelf.slug} className="vp-chip" href={`/videos/${shelf.slug}`}>
              {shelf.name}
            </a>
          ))}
          <a className="vp-chip" href="/videos/archive">
            {t("video.allInSection")}
          </a>
        </nav>
      </div>
    </header>
  );
}
