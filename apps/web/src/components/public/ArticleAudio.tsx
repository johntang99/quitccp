"use client";

import { useEffect, useRef, useState } from "react";
import { externalLinkProps } from "@/lib/external-services";

/**
 * The player for a 歌曲 or 乐曲 recording.
 *
 * The browser's own `<audio controls>` is grey system chrome that belongs to no
 * design: on a page set in Noto Serif with a gold-and-purple palette it reads as
 * a piece of unfinished plumbing. This is the same set of controls -- play,
 * seek, elapsed, duration, volume, download -- drawn in the site's own language.
 *
 * ## Nothing is fetched until the reader asks for it
 *
 * `preload="none"` is kept deliberately. These recordings are still hosted on
 * the old server, so loading metadata on render would announce every reader who
 * merely opens a music page to that host. The cost is that the duration is not
 * known until playback starts, so it shows as `--:--` until then. That is the
 * honest trade: a reader who never presses play makes no request at all.
 *
 * A `<audio>` element with no `controls` attribute is still a complete audio
 * implementation, so keyboard users and screen readers get real button and
 * slider semantics from the controls below rather than a simulation.
 */

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function ArticleAudio({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const onTime = () => setCurrent(element.currentTime);
    const onMeta = () => setDuration(element.duration);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    element.addEventListener("timeupdate", onTime);
    element.addEventListener("loadedmetadata", onMeta);
    element.addEventListener("durationchange", onMeta);
    element.addEventListener("ended", onEnd);
    element.addEventListener("play", () => setPlaying(true));
    element.addEventListener("pause", () => setPlaying(false));
    element.addEventListener("error", () => setFailed(true));
    return () => {
      element.removeEventListener("timeupdate", onTime);
      element.removeEventListener("loadedmetadata", onMeta);
      element.removeEventListener("durationchange", onMeta);
      element.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setFailed(true));
    else element.pause();
  };

  const seek = (value: number) => {
    const element = audio.current;
    if (!element || !Number.isFinite(duration)) return;
    element.currentTime = value;
    setCurrent(value);
  };

  const changeVolume = (value: number) => {
    const element = audio.current;
    setVolume(value);
    setMuted(value === 0);
    if (element) {
      element.volume = value;
      element.muted = value === 0;
    }
  };

  const toggleMute = () => {
    const element = audio.current;
    const next = !muted;
    setMuted(next);
    if (element) element.muted = next;
  };

  const format = (src.match(/\.([a-z0-9]{2,4})(?:\?|$)/i)?.[1] ?? "").toUpperCase();

  // Before playback the duration is unknown, so the bar has nothing to scale to.
  const progress = Number.isFinite(duration) && duration > 0 ? (current / duration) * 100 : 0;

  return (
    <figure className="aplayer">
      <audio ref={audio} src={src} preload="none">
        <a href={src}>{label}</a>
      </audio>

      <div className="aplayer-main">
        <button
          type="button"
          className="aplayer-play"
          onClick={toggle}
          aria-label={playing ? "暂停" : "播放"}
        >
          {/* Drawn rather than typed: a glyph would inherit the serif face and
              sit off-centre inside a circle. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {playing ? (
              <>
                <rect x="7" y="5" width="3.6" height="14" rx="1" />
                <rect x="13.4" y="5" width="3.6" height="14" rx="1" />
              </>
            ) : (
              <path d="M8 5.2v13.6a.8.8 0 0 0 1.22.68l11-6.8a.8.8 0 0 0 0-1.36l-11-6.8A.8.8 0 0 0 8 5.2z" />
            )}
          </svg>
        </button>

        {/* Elapsed and remaining flank the bar rather than sitting under it, so
            the bar shares one baseline with the play button and the volume
            slider. Stacked, it rode above them and the row read as crooked. */}
        <span className="aplayer-time">{clock(current)}</span>
        <input
          type="range"
          className="aplayer-range aplayer-range--seek"
          min={0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 100}
          step={0.1}
          value={current}
          onChange={(event) => seek(Number(event.target.value))}
          disabled={!Number.isFinite(duration)}
          aria-label="播放进度"
          style={{ ["--played" as string]: `${progress}%` }}
        />
        <span className="aplayer-time">{clock(duration)}</span>

        <div className="aplayer-vol">
          <button type="button" onClick={toggleMute} aria-label={muted ? "取消静音" : "静音"}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 9.5v5h3.5L12 18.8V5.2L7.5 9.5H4z" />
              {muted ? (
                <path d="M15.5 9.5l5 5m0-5l-5 5" strokeWidth="1.8" stroke="currentColor" fill="none" strokeLinecap="round" />
              ) : (
                <path
                  d="M15.2 8.8a4.4 4.4 0 0 1 0 6.4M17.6 6.4a7.8 7.8 0 0 1 0 11.2"
                  strokeWidth="1.6"
                  stroke="currentColor"
                  fill="none"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
          <input
            type="range"
            className="aplayer-range aplayer-range--vol"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            aria-label="音量"
            style={{ ["--played" as string]: `${(muted ? 0 : volume) * 100}%` }}
          />
        </div>
      </div>

      <figcaption className="aplayer-foot">
        <a href={src} {...externalLinkProps(src)}>
          {label}
        </a>
        {/* The format, read off the address: it costs no request and tells the
            reader what they would be saving before they commit to it. */}
        {failed ? (
          <span className="aplayer-error">无法播放，请改用下载链接。</span>
        ) : (
          <span className="aplayer-kind">{format}</span>
        )}
      </figcaption>
    </figure>
  );
}
