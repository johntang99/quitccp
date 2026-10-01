"use client";

import { useState } from "react";
import { isFileUrl, toEmbedUrl, youtubeIdOf } from "@/lib/video-host";

/**
 * A video embedded in an article body.
 *
 * Click to play, so nothing is requested from YouTube until the reader asks for
 * it. That matters twice over here: no third-party request on page load, and a
 * blocked host -- which YouTube is, for readers inside mainland China -- cannot
 * stall the article. The rest of the page reads normally either way.
 *
 * The still behind the play button comes through our own
 * /api/public/video-thumbnail rather than from i.ytimg.com, so showing it keeps
 * that promise instead of quietly breaking it. A self-hosted file shows its own
 * first frame, which costs nobody anything. Anything else keeps the plain
 * button, as does a poster that fails to load.
 */
export function ArticleVideo({ src, caption }: { src: string; caption: string }) {
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const embed = toEmbedUrl(src);
  if (!embed) return null;

  const youtubeId = youtubeIdOf(src);
  const poster = youtubeId && !posterFailed
    ? `/api/public/video-thumbnail?v=${encodeURIComponent(youtubeId)}`
    : "";
  const file = isFileUrl(embed);

  return (
    <figure style={{ margin: "34px 0" }}>
      <div style={{ position: "relative", background: "#111", aspectRatio: "16 / 9", overflow: "hidden" }}>
        {playing ? (
          file ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={embed} controls autoPlay playsInline style={{ width: "100%", height: "100%" }} />
          ) : (
            <iframe
              src={`${embed}${embed.includes("?") ? "&" : "?"}autoplay=1`}
              title={caption || "视频"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={caption ? `播放：${caption}` : "播放视频"}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              padding: 0,
              border: 0,
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              display: "block"
            }}
          >
            {poster ? (
              <img
                src={poster}
                alt=""
                onError={() => setPosterFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : file ? (
              // Our own file, so loading its metadata is a request the reader
              // was already going to make.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={embed}
                preload="metadata"
                muted
                playsInline
                tabIndex={-1}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
              />
            ) : null}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 40,
                // Keeps the glyph readable over a bright frame without hiding it.
                textShadow: "0 2px 14px rgba(0,0,0,0.65)",
                background: poster || file ? "rgba(17,17,17,0.22)" : "transparent"
              }}
            >
              ▶
            </span>
          </button>
        )}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
