"use client";

import { useState } from "react";

export interface GalleryItem {
  src: string;
  alt: string;
}

/**
 * Hero gallery: one large image with a thumbnail strip underneath.
 *
 * Deliberately not auto-advancing. The hero is the first thing a reader sees,
 * and motion there competes with the headline; it also makes the page harder to
 * use for anyone who needs time to read.
 */
export function HeroGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState(0);
  const shown = items[active] ?? items[0];
  if (!shown) return null;

  return (
    <div className="hero-gallery">
      <div className="hero-gallery-main">
        <img src={shown.src} alt={shown.alt} />
      </div>
      {items.length > 1 ? (
        <div className="hero-gallery-thumbs" role="tablist" aria-label="图集">
          {items.map((item, index) => (
            <button
              key={`${item.src}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={item.alt || `图片 ${index + 1}`}
              className={index === active ? "is-active" : undefined}
              onClick={() => setActive(index)}
            >
              <img src={item.src} alt="" />
            </button>
          ))}
        </div>
      ) : null}
      {shown.alt ? <p className="hero-media-caption">{shown.alt}</p> : null}
    </div>
  );
}

function isEmbedUrl(src: string): boolean {
  return !/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i.test(src.trim());
}

/**
 * Click-to-play hero video.
 *
 * Nothing is requested until the viewer clicks. For a third-party embed that
 * matters twice over: no tracking request on page load, and a blocked host
 * (common for readers inside mainland China) cannot stall the homepage -- the
 * poster still renders and the rest of the page is unaffected.
 */
export function HeroVideo({
  src,
  poster,
  caption
}: {
  src: string;
  poster: string;
  caption: string;
}) {
  const [playing, setPlaying] = useState(false);
  const trimmed = src.trim();
  const hasVideo = trimmed.length > 0;

  if (playing && hasVideo) {
    return (
      <div className="hero-video">
        <div className="hero-video-frame">
          {isEmbedUrl(trimmed) ? (
            <iframe
              src={trimmed}
              title={caption || "视频"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={trimmed} poster={poster} controls autoPlay playsInline />
          )}
        </div>
        {caption ? <p className="hero-media-caption">{caption}</p> : null}
      </div>
    );
  }

  return (
    <div className="hero-video">
      <div className="hero-video-frame">
        {poster ? <img src={poster} alt={caption || ""} /> : <div className="hero-video-placeholder" />}
        {hasVideo ? (
          <button
            type="button"
            className="hero-video-play"
            onClick={() => setPlaying(true)}
            aria-label={caption ? `播放：${caption}` : "播放视频"}
          >
            <span aria-hidden="true">▶</span>
          </button>
        ) : null}
      </div>
      {caption ? <p className="hero-media-caption">{caption}</p> : null}
      {!hasVideo ? (
        <p className="hero-media-caption">尚未设置视频地址。</p>
      ) : null}
    </div>
  );
}
