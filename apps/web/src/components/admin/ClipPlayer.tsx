"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Watch a source and mark the two ends of a clip.
 *
 * This is the part of cutting that is actually a judgement -- which three
 * seconds -- and it is the part that needs no render machine at all. The
 * browser plays 干净世界's stream directly (their CDN sends
 * `access-control-allow-origin: *`), so an editor can scrub to a frame and
 * press 设为起点 wherever the site is running, Vercel included.
 *
 * Before this, choosing a moment meant asking the server for a contact sheet
 * and reading seconds off a grid of thumbnails. That worked, but it needed
 * ffmpeg for what a video element does by itself.
 *
 * hls.js is loaded only when a player opens, and only where it is needed:
 * Safari plays .m3u8 natively and gets the file straight on the element.
 */
export function ClipPlayer({
  source,
  from,
  to,
  onSetFrom,
  onSetTo
}: {
  source: string;
  from: number;
  to: number;
  onSetFrom: (t: number) => void;
  onSetTo: (t: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"hls" | "file">("file");
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);

  /* Resolving runs on the server: 干净世界's *pages* are not CORS-open, only
     their streams are, so the page cannot read the stream address itself. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProblem("");
    setUrl("");
    (async () => {
      try {
        const res = await fetch("/api/admin/studio/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source })
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setProblem(String(data.error ?? "打不开"));
          return;
        }
        setUrl(String(data.url));
        setKind(data.kind === "hls" ? "hls" : "file");
      } catch (err) {
        if (!cancelled) setProblem(err instanceof Error ? err.message : "打不开");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  /*
   * Attaching the stream.
   *
   * hls.js first wherever Media Source Extensions exist, and the browser's own
   * player only as the fallback. The obvious way round -- ask the element what
   * it can play and reach for the library only if it says no -- does not work:
   * Chrome answers "maybe" for `application/vnd.apple.mpegurl` and then fails
   * with MEDIA_ERR_SRC_NOT_SUPPORTED the moment it tries. Only Safari means it.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    let destroy: (() => void) | undefined;
    let cancelled = false;

    if (kind === "hls") {
      void (async () => {
        const Hls = (await import("hls.js")).default;
        if (cancelled) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setProblem(`放不了：${data.details}`);
          });
          destroy = () => hls.destroy();
          return;
        }
        // No MSE: Safari and iOS, which play the playlist directly.
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          return;
        }
        setProblem("这个浏览器放不了这种流，换 Chrome、Edge 或 Safari 试试");
      })();
    } else {
      video.src = url;
    }
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url, kind]);

  /* Jump to the clip's start once there is something to jump to. */
  const seek = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, t);
  };

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  };

  const len = Math.max(0, to - from);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {loading ? <p className="muted" style={{ margin: 0 }}>正在打开…</p> : null}
      {problem ? (
        <p style={{ margin: 0, color: "#b42318", background: "#fef3f2", padding: "8px 10px", borderRadius: 4 }}>
          {problem}
        </p>
      ) : null}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        style={{ width: "100%", maxWidth: 720, borderRadius: 6, background: "#111", display: url ? "block" : "none" }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          if (from > 0) e.currentTarget.currentTime = from;
        }}
        onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
      />

      {url ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 15,
                fontVariantNumeric: "tabular-nums",
                minWidth: 118
              }}
            >
              {fmt(now)}
              <span style={{ color: "#999", fontSize: 12 }}> / {fmt(duration)}</span>
            </span>
            <button className="admin-btn admin-btn-sm" type="button" onClick={() => onSetFrom(+now.toFixed(2))}>
              设为起点
            </button>
            <button className="admin-btn admin-btn-sm" type="button" onClick={() => onSetTo(+now.toFixed(2))}>
              设为终点
            </button>
            <span style={{ width: 12 }} />
            {/* A frame at a time, because the difference between a good in-point
                and a bad one is often one frame of someone blinking. */}
            {([["−1 秒", -1], ["−1 帧", -1 / 30], ["＋1 帧", 1 / 30], ["＋1 秒", 1]] as const).map(([label, by]) => (
              <button
                key={label}
                className="admin-btn admin-btn-sm"
                type="button"
                onClick={() => seek((videoRef.current?.currentTime ?? 0) + by)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
            <button className="admin-btn admin-btn-sm" type="button" onClick={() => seek(from)}>
              跳到起点 {from}s
            </button>
            <button className="admin-btn admin-btn-sm" type="button" onClick={() => seek(Math.max(0, to - 0.2))}>
              跳到终点 {to}s
            </button>
            <button
              className="admin-btn admin-btn-sm"
              type="button"
              title="从起点放到终点，听听这一段的长短"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = from;
                void video.play();
                const stop = () => {
                  if (video.currentTime >= to) {
                    video.pause();
                    video.removeEventListener("timeupdate", stop);
                  }
                };
                video.addEventListener("timeupdate", stop);
              }}
            >
              ▶ 只放这一段
            </button>
            <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              这一段 {len.toFixed(2)} 秒
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
