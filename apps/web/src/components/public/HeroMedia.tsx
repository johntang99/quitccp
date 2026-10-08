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
 *
 * It renders the `.hero-media` backdrop layer itself rather than being dropped
 * into one, so that the speaker button can sit *outside* that layer. `.hero-media`
 * is absolutely positioned with a z-index, which makes it a stacking context:
 * a button inside it can never rise above `.hero-grid`, and the grid covers the
 * whole hero, so every click on the button landed on the grid instead.
 */
/** Where a visitor's own choice is remembered, so it outlives the visit. */
const SOUND_CHOICE_KEY = "quitccp.heroSound";

export function HeroBackgroundVideo({
  src,
  poster,
  alt,
  hasAudio,
  soundOn
}: {
  src: string;
  poster: string;
  alt: string;
  /** Only then is the speaker button worth showing. */
  hasAudio: boolean;
  /**
   * The centre's preference for how the backdrop should arrive.
   *
   * It is a preference and not an instruction, because no site can decide this
   * on its own -- see the unmuting effect below.
   */
  soundOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // Starts false so the server and the first client paint agree on the poster;
  // the effect decides whether this reader should get motion at all.
  const [play, setPlay] = useState(false);
  const [failed, setFailed] = useState(false);
  /** True once a visitor has worked the button; their choice then outranks the setting. */
  const chosen = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (reduce || connection?.saveData) return;
    setPlay(true);
  }, []);

  /*
   * Reaching for sound on arrival.
   *
   * No browser lets a page start making noise by itself, and none of them make
   * an exception for a backdrop: `play()` on an unmuted video is simply
   * rejected. So 「打开首页时就出声」 cannot be obeyed literally, and this does
   * the two things that are actually possible.
   *
   * First it tries, because the rule is not absolute: a browser does allow it
   * once the visitor has built up enough history with the site (Chrome's media
   * engagement index), and on a return visit that often succeeds. If the
   * attempt is rejected the video goes straight back to muted and keeps
   * playing -- a silent backdrop, never a stalled one.
   *
   * When it is refused, the first real click or key anywhere on the page is a
   * gesture the browser accepts, so sound is switched on then. That listener is
   * dropped the moment it fires, or if the visitor touches the speaker button
   * first: a setting must never overrule a person who has just said no.
   */
  useEffect(() => {
    if (!play || !hasAudio) return;
    const video = videoRef.current;
    if (!video) return;

    let remembered: string | null = null;
    try {
      remembered = window.localStorage.getItem(SOUND_CHOICE_KEY);
    } catch {
      /* private window, or site data blocked -- fall through to the setting */
    }
    // A visitor who has chosen before gets what they chose, either way.
    if (remembered === "off") return;
    if (remembered !== "on" && !soundOn) return;

    let cancelled = false;
    const unmute = () => {
      if (cancelled || chosen.current) return;
      video.muted = false;
      void video.play().then(
        () => {
          if (!cancelled && !chosen.current) setMuted(false);
        },
        () => {
          // Refused. Silent and running beats correct and frozen.
          video.muted = true;
          void video.play().catch(() => {});
        }
      );
    };

    unmute();

    const onGesture = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      unmute();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [play, hasAudio, soundOn]);

  // Driven from state rather than set once on the element: the muted attribute
  // and the property can disagree after hydration, and the property is the one
  // the browser actually plays by.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, play]);

  /** The visitor's own call: applied, remembered, and final. */
  const toggleSound = () => {
    chosen.current = true;
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(SOUND_CHOICE_KEY, next ? "off" : "on");
    } catch {
      /* not being able to remember it is no reason not to honour it now */
    }
  };

  if (failed || !play) {
    return poster ? (
      <div className="hero-media">
        <img src={poster} alt={alt} />
      </div>
    ) : null;
  }

  return (
    <>
      <div className="hero-media">
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
      </div>
      {hasAudio ? (
        <button
          type="button"
          className="hero-sound"
          onClick={toggleSound}
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
