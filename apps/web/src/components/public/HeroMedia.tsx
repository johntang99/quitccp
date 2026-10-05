"use client";

import { useEffect, useRef, useState } from "react";

export interface GalleryItem {
  src: string;
  alt: string;
}

/** Auto-advance interval. */
const ROTATE_MS = 5000;

/**
 * Hero gallery: one large image with a thumbnail strip underneath, advancing
 * on its own.
 *
 * Three things keep the motion from becoming a nuisance:
 * - it pauses while the pointer or keyboard focus is inside the gallery, so it
 *   cannot swap the image out from under someone who is looking at it;
 * - picking a thumbnail restarts the clock rather than advancing a moment later;
 * - `prefers-reduced-motion` stops it entirely.
 */
export function HeroGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on manual selection to restart the interval from that moment.
  const [restart, setRestart] = useState(0);
  const count = items.length;
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion.current) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, restart]);

  const select = (index: number) => {
    setActive(index);
    setRestart((n) => n + 1);
  };

  const shown = items[active] ?? items[0];
  if (!shown) return null;

  return (
    <div
      className="hero-gallery"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
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
              onClick={() => select(index)}
            >
              <img src={item.src} alt="" />
            </button>
          ))}
        </div>
      ) : null}
      {shown.alt ? <p className="hero-media-caption">{shown.alt}</p> : null}
      <span className="sr-only" aria-live="polite">
        第 {active + 1} 张，共 {count} 张
      </span>
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

/**
 * The full-bleed hero backdrop as video instead of a photograph.
 *
 * Autoplay is only ever allowed muted -- every browser blocks a video that
 * starts making noise on its own, and none of them make an exception for a
 * backdrop. So the video starts silent and a speaker button turns sound on,
 * which works because the click is a user gesture. That is not a compromise
 * around the rule; it is the only shape autoplay can take.
 *
 * Three things make it degrade to the photograph rather than to a black box:
 * - `prefers-reduced-motion` means no autoplay. A backdrop that loops forever is
 *   exactly what that setting is about, so those readers get the still poster.
 * - the browser's data-saver flag does the same, because a hero video is the
 *   largest thing on the page and the reader has said not to spend their data.
 * - a failed load falls back to the poster image, so a missing or blocked file
 *   leaves the hero looking finished instead of empty.
 */
export function HeroBackgroundVideo({
  src,
  poster,
  alt,
  hasAudio
}: {
  src: string;
  poster: string;
  alt: string;
  /** Only then is the speaker button worth showing. */
  hasAudio: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // Starts false so the server and the first client paint agree on the poster;
  // the effect decides whether this reader should get motion at all.
  const [play, setPlay] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (reduce || connection?.saveData) return;
    setPlay(true);
  }, []);

  // Driven from state rather than set once on the element: the muted attribute
  // and the property can disagree after hydration, and the property is the one
  // the browser actually plays by.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, play]);

  if (failed || !play) {
    return poster ? <img src={poster} alt={alt} /> : null;
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={alt}
        onError={() => setFailed(true)}
      />
      {hasAudio ? (
        <button
          type="button"
          className="hero-sound"
          onClick={() => setMuted((on) => !on)}
          aria-pressed={!muted}
          aria-label={muted ? "打开声音" : "关闭声音"}
          title={muted ? "打开声音" : "关闭声音"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            {muted ? (
              <path d="m17 9 4 6M21 9l-4 6" />
            ) : (
              <>
                <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19 6a8.5 8.5 0 0 1 0 12" />
              </>
            )}
          </svg>
        </button>
      ) : null}
    </>
  );
}
