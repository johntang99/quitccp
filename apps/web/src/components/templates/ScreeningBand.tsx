import type { HomeContent } from "@quitccp/content-schema";
import { externalLinkProps } from "@/lib/external-services";

/**
 * 放映室 — the video section as a screening room.
 *
 * Implements `docs/prototypes/home-video-section-html`. The section used to be
 * a flat row of three thumbnails; here a dark auditorium band carries the
 * series nav, one large featured poster with its copy beside it, and the latest
 * films underneath.
 *
 * Design values (gradient, gold, radii, chip sizes) are lifted from the
 * mockup's inline styles and live in `globals.css` under `.screening-*`.
 * Everything that moves is CSS hover, so this stays a server component.
 */

export function ScreeningBand({ video }: { video: HomeContent["video"] }) {
  const featured = video.featured;

  return (
    <section id="video" className="sec screening">
      {/* Low gold wash behind the poster. Decorative only. */}
      <span className="screening-glow" aria-hidden="true" />

      <div className="wrap screening-inner">
        <div className="screening-head">
          <span className="screening-eyebrow">{video.eyebrow}</span>
          <div className="screening-head-row">
            <h2>{video.heading}</h2>
            {video.series.length > 0 ? (
              <nav className="screening-series" aria-label="视频系列">
                {video.series.map((item) => (
                  <a
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    className={item.active ? "is-active" : undefined}
                    aria-current={item.active ? "page" : undefined}
                    {...externalLinkProps(item.href)}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
          {video.lede ? <p className="screening-lede">{video.lede}</p> : null}
        </div>

        <div className="screening-feature">
          <a
            className="screening-poster"
            href={featured.href}
            aria-label={`播放：${featured.title}`}
            {...externalLinkProps(featured.href)}
          >
            {featured.image ? <img src={featured.image} alt="" /> : null}
            <span className="screening-scrim" aria-hidden="true" />
            <span className="screening-play" aria-hidden="true">
              ▶
            </span>
            {featured.duration ? (
              <span className="screening-dur">{featured.duration}</span>
            ) : null}
          </a>

          <div className="screening-copy">
            {featured.tag ? <span className="screening-tag">{featured.tag}</span> : null}
            <h3>{featured.title}</h3>
            <p>{featured.body}</p>
            {featured.meta.length > 0 ? (
              <div className="screening-pills">
                {featured.meta.map((entry) => (
                  <span key={entry}>{entry}</span>
                ))}
              </div>
            ) : null}
            <div className="screening-actions">
              {featured.primaryLabel ? (
                <a
                  className="screening-btn screening-btn--gold"
                  href={featured.primaryHref}
                  {...externalLinkProps(featured.primaryHref)}
                >
                  <span aria-hidden="true">▶</span> {featured.primaryLabel}
                </a>
              ) : null}
              {featured.secondaryLabel ? (
                <a
                  className="screening-btn"
                  href={featured.secondaryHref}
                  {...externalLinkProps(featured.secondaryHref)}
                >
                  {featured.secondaryLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="screening-latest">
          <div className="screening-latest-head">
            <span className="screening-latest-title">
              <span className="screening-dot" aria-hidden="true" />
              {video.latestLabel}
            </span>
            <a
              className="screening-more"
              href={video.moreHref}
              {...externalLinkProps(video.moreHref)}
            >
              {video.moreLabel} →
            </a>
          </div>

          <div className="screening-grid">
            {video.items.map((item) => (
              <a
                key={`${item.title}-${item.href}`}
                className="screening-card"
                href={item.href}
                {...externalLinkProps(item.href)}
              >
                <span className="screening-thumb">
                  {item.image ? <img src={item.image} alt="" /> : null}
                  <span className="screening-play screening-play--sm" aria-hidden="true">
                    ▶
                  </span>
                  {item.duration ? (
                    <span className="screening-dur screening-dur--sm">{item.duration}</span>
                  ) : null}
                  {item.badge ? <span className="screening-new">{item.badge}</span> : null}
                </span>
                <span className="screening-card-meta">{item.meta}</span>
                <span className="screening-card-title">{item.title}</span>
              </a>
            ))}
          </div>
        </div>

        {video.footNote || video.footMark ? (
          <div className="screening-foot">
            <span>{video.footNote}</span>
            <span className="screening-foot-mark">{video.footMark}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
