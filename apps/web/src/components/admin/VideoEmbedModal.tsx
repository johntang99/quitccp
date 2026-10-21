"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { createPortal } from "react-dom";
import { hostOf, isFileUrl, isGanjingWatchUrl, toEmbedUrl } from "@/lib/video-host";

/**
 * Insert a video into an article, video or material body.
 *
 * This replaces a `window.prompt`, which had room for one line of label and no
 * way to show what it had understood. The thing it could not say is the one an
 * editor most needs to know: 干净世界's /video/ address -- the one the browser
 * bar gives you -- cannot be embedded, and has to be the /embed/ form.
 *
 * So the address is echoed back as a live preview and a recognised host, and a
 * /video/ address is converted on the way in, with both forms shown. An editor
 * who pastes the wrong one learns the rule here rather than finding a black box
 * in the preview pane.
 */
export function VideoEmbedModal({
  onInsert,
  onClose
}: {
  onInsert: (markdown: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = url.trim();
  /* What actually gets written -- the /embed/ form for 干净世界. */
  const embed = toEmbedUrl(trimmed);
  const converted = Boolean(embed) && embed !== trimmed;
  const host = hostOf(embed);
  const known = Boolean(embed) && host.key !== "other" && host.key !== "none";

  /*
   * Only an address the renderer can actually play may be inserted. Anything
   * else becomes a block that reads "▶ 认不出的视频地址" on the page, which is
   * a worse outcome than being stopped here -- and the old window.prompt let
   * exactly that through.
   */
  const insert = () => {
    if (!known) return;
    onInsert(`\n::: video ${embed}\n${caption.trim() || t("admin.vidembed.defaultCaption")}\n:::\n`);
    onClose();
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="videoembed-h"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,13,45,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 20
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 6,
          width: "min(620px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "20px 22px 18px",
          boxShadow: "0 18px 48px rgba(18,13,45,.28)"
        }}
      >
        <h3 id="videoembed-h" style={{ margin: "0 0 4px", fontSize: 17 }}>
          {t("admin.vidembed.title")}
        </h3>
        <p style={{ margin: "0 0 14px", color: "#8a90a0", fontSize: 13, lineHeight: 1.6 }}>
          {t("admin.vidembed.subtitle")}
        </p>

        <label htmlFor="videoembed-url" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
          {t("admin.vidembed.url")}
        </label>
        <input
          className="admin-input"
          id="videoembed-url"
          ref={inputRef}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && known) {
              event.preventDefault();
              insert();
            }
          }}
          placeholder={t("admin.vidform.sourcePlaceholder")}
          style={{ fontFamily: "ui-monospace, Menlo, monospace", width: "100%" }}
        />

        {/* Stated up front, not only after a wrong address is pasted. */}
        <p style={{ margin: "6px 0 0", color: "#8a90a0", fontSize: 12.5, lineHeight: 1.65 }}>
          {tRich("admin.vidembed.hint", {
            a: <code>/video/</code>,
            b: <code>vimeo.com/…</code>
          })}
          {trimmed && known ? (
            <strong style={{ color: "#555" }}>{t("admin.vidform.recognisedAs", { host: host.label })}</strong>
          ) : null}
          {trimmed && !known ? (
            <strong style={{ color: "#b42318" }}>{t("admin.vidembed.unknown")}</strong>
          ) : null}
        </p>

        {converted ? (
          <div
            style={{
              margin: "10px 0 0",
              padding: "9px 11px",
              background: "#f0fbf4",
              border: "1px solid #bfe6cf",
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.7,
              fontFamily: "ui-monospace, Menlo, monospace",
              wordBreak: "break-all"
            }}
          >
            <div style={{ textDecoration: "line-through", opacity: 0.6 }}>{trimmed}</div>
            <div style={{ color: "#1f7a4d" }}>{embed}</div>
            <div style={{ fontFamily: "inherit", marginTop: 2, color: "#1f7a4d", fontSize: 12.5 }}>
              {t(isGanjingWatchUrl(trimmed) ? "admin.vidembed.fixedGanjing" : "admin.vidembed.fixedOther")}
            </div>
          </div>
        ) : null}

        <label
          htmlFor="videoembed-caption"
          style={{ display: "block", fontSize: 13, margin: "14px 0 4px" }}
        >
          {t("admin.vidembed.caption")}
        </label>
        <input
          className="admin-input"
          id="videoembed-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={t("admin.vidembed.captionPlaceholder")}
          style={{ width: "100%" }}
        />

        {known ? (
          <div style={{ marginTop: 14 }}>
            {isFileUrl(embed) ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={embed}
                controls
                style={{ width: "100%", borderRadius: 4, background: "#111" }}
              />
            ) : (
              <iframe
                src={embed}
                title={t("admin.preview")}
                allowFullScreen
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  border: 0,
                  borderRadius: 4,
                  background: "#111"
                }}
              />
            )}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="admin-btn" type="button" onClick={onClose}>
            {t("admin.cancel")}
          </button>
          <button
            className="admin-btn admin-btn-primary"
            type="button"
            onClick={insert}
            disabled={!known}
          >
            {t("admin.vidembed.insert")}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
}
