"use client";

import { useState } from "react";
import { isFileUrl, toEmbedUrl } from "@/lib/video-host";

/**
 * A video embedded in an article body.
 *
 * Click to play, so nothing is requested from YouTube until the reader asks for
 * it. That matters twice over here: no third-party request on page load, and a
 * blocked host -- which YouTube is, for readers inside mainland China -- cannot
 * stall the article. The rest of the page reads normally either way.
 */
export function ArticleVideo({ src, caption }: { src: string; caption: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = toEmbedUrl(src);
  if (!embed) return null;

  return (
    <figure style={{ margin: "34px 0" }}>
      <div style={{ position: "relative", background: "#111", aspectRatio: "16 / 9", overflow: "hidden" }}>
        {playing ? (
          isFileUrl(embed) ? (
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
              width: "100%",
              height: "100%",
              border: 0,
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 40
            }}
          >
            <span aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
