"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaRecord } from "@/lib/admin/types";

/**
 * The picture and video library.
 *
 * It replaced a table of file names and raw URLs, which told an editor looking
 * for a photograph nothing at all -- you cannot recognise a picture from
 * `id14856852-WSY9416-scaled.jpg`. Pictures are shown as pictures and clips as
 * clips, split into two tabs because looking for one is never looking for the
 * other.
 *
 * Documents and archives are deliberately absent. They live with the material
 * they belong to, and a library that mixes a PDF in among the photographs is
 * the table this replaced.
 */

type Tab = "image" | "video";

const PAGE_SIZE = 60;

/**
 * A thumbnail URL, via Storage's own resizer.
 *
 * The originals run to several megabytes each -- one PNG here is 2.8MB -- and a
 * grid of sixty of them would be a hundred-megabyte page. Asking Storage for a
 * 320px wide copy returns ~48KB of WebP instead, which is what makes showing
 * thousands of pictures possible at all. Falls back to the original if the URL
 * is not a Storage object.
 */
function thumbnailUrl(url: string): string {
  if (!url.includes("/object/public/")) return url;
  const base = url.split("?")[0].replace("/object/public/", "/render/image/public/");
  return `${base}?width=320&quality=60`;
}

/**
 * A thumbnail that falls back to the original file.
 *
 * Storage's resizer refuses a source it considers too big -- one 9.7MB scan in
 * the materials folder comes back `InvalidRequest: source image resolution is
 * too large` -- and the alternative to paying for the full file in those few
 * cases is an empty square where a picture should be.
 */
function Thumb({ url }: { url: string }) {
  const [src, setSrc] = useState(() => thumbnailUrl(url));
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setSrc((current) => (current === url ? current : url))}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary({
  initialRows,
  initialTotals,
  canWrite
}: {
  initialRows: Record<Tab, MediaRecord[]>;
  initialTotals: Record<Tab, number>;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<Tab>("image");
  const [rows, setRows] = useState(initialRows);
  const [totals] = useState(initialTotals);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<MediaRecord | null>(null);
  const [query, setQuery] = useState("");
  // Saved captions are kept here so the grid updates without a reload, which
  // would throw away every page the reader has already loaded.
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const captionOf = (row: MediaRecord) => captions[row.id] ?? row.description ?? "";

  const loadMore = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/content/media/list?type=${tab}&offset=${rows[tab].length}&limit=${PAGE_SIZE}`
      );
      const payload = (await response.json()) as { rows?: MediaRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "读取失败");
      setRows((current) => ({ ...current, [tab]: [...current[tab], ...(payload.rows ?? [])] }));
    } catch {
      /* The button stays; pressing it again retries. */
    } finally {
      setLoading(false);
    }
  };

  const loaded = rows[tab];
  const q = query.trim().toLowerCase();
  // Filtering is over what has been loaded, which the count below says plainly
  // rather than implying the whole library was searched.
  const shown = q
    ? loaded.filter(
        (row) => row.name.toLowerCase().includes(q) || captionOf(row).toLowerCase().includes(q)
      )
    : loaded;

  return (
    <>
      <section className="admin-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(
              [
                ["image", `图片（${totals.image}）`],
                ["video", `视频（${totals.video}）`]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="admin-btn"
                style={
                  tab === key
                    ? { background: "#4a3ca0", borderColor: "#4a3ca0", color: "#fff" }
                    : undefined
                }
              >
                {label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12.5, color: "#777" }}>
            已载入 {loaded.length} / {totals[tab]}
            {q ? `，其中 ${shown.length} 条匹配` : ""}
          </span>
          <input
            className="admin-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="在已载入的里按文件名或说明筛选"
            style={{ maxWidth: 300, marginLeft: "auto" }}
          />
        </div>
      </section>

      <section className="admin-card">
        {shown.length === 0 ? (
          <p style={{ margin: 0, color: "#777" }}>
            {q ? "已载入的里没有匹配项，可以先「载入更多」。" : "还没有内容。"}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 16
            }}
          >
            {shown.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpen(row)}
                style={{
                  display: "grid",
                  gap: 7,
                  padding: 0,
                  border: "1px solid #e7e7ec",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  overflow: "hidden"
                }}
                title={row.name}
              >
                <span
                  style={{
                    display: "block",
                    aspectRatio: "4 / 3",
                    background: "#f3f3f6",
                    position: "relative"
                  }}
                >
                  {tab === "image" ? (
                    <Thumb url={row.url} />
                  ) : (
                    <>
                      {/* `preload="metadata"` renders the first frame as a still
                          without fetching the whole clip -- a grid of videos
                          that each downloaded in full would be unusable. */}
                      <video
                        src={row.url}
                        preload="metadata"
                        muted
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "grid",
                          placeItems: "center",
                          color: "#fff",
                          fontSize: 34,
                          textShadow: "0 1px 6px rgba(0,0,0,.6)"
                        }}
                      >
                        ▶
                      </span>
                    </>
                  )}
                </span>
                <span style={{ padding: "0 10px 10px", display: "grid", gap: 3 }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {row.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: "#777" }}>
                    {captionOf(row) || "（未填写说明）"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {loaded.length < totals[tab] ? (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button type="button" className="admin-btn" onClick={() => void loadMore()} disabled={loading}>
              {loading ? "载入中…" : `载入更多（还有 ${totals[tab] - loaded.length} 条）`}
            </button>
          </div>
        ) : null}
      </section>

      {open ? (
        <MediaModal
          row={open}
          caption={captionOf(open)}
          canWrite={canWrite}
          onCaption={(value) => setCaptions((current) => ({ ...current, [open.id]: value }))}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function MediaModal({
  row,
  caption,
  canWrite,
  onCaption,
  onClose
}: {
  row: MediaRecord;
  caption: string;
  canWrite: boolean;
  onCaption: (value: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(caption);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/content/media/describe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, description: draft })
      });
      const payload = (await response.json()) as { error?: string; description?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败。");
      onCaption(payload.description ?? draft.trim());
      setStatus("已保存。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(row.url);
    } catch {
      // The clipboard API needs a secure context and permission; selecting the
      // text leaves the reader one keystroke from copying it themselves rather
      // than a button that silently did nothing.
      urlRef.current?.select();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const video = row.type === "video" || /\.(mp4|webm)$/i.test(row.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={row.name}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(16, 13, 36, .72)",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          maxWidth: "min(1100px, 100%)",
          maxHeight: "100%",
          overflow: "auto",
          display: "grid",
          gap: 14,
          padding: 18
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong style={{ fontSize: 14, wordBreak: "break-all" }}>{row.name}</strong>
          <button
            ref={closeRef}
            type="button"
            className="admin-btn"
            onClick={onClose}
            style={{ marginLeft: "auto" }}
          >
            关闭
          </button>
        </div>

        {video ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={row.url}
            controls
            autoPlay
            playsInline
            style={{ width: "100%", maxHeight: "62vh", background: "#000", display: "block" }}
          />
        ) : (
          <img
            src={row.url}
            alt={caption || row.name}
            style={{ width: "100%", maxHeight: "62vh", objectFit: "contain", display: "block" }}
          />
        )}

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12.5, color: "#555" }}>
            说明（Description）
            <textarea
              className="admin-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              readOnly={!canWrite}
              rows={3}
              maxLength={500}
              placeholder={canWrite ? "这张图/这段视频拍的是什么、在哪里、什么时候" : "（无编辑权限）"}
              style={{ width: "100%", marginTop: 4, resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {canWrite ? (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => void save()}
                disabled={saving || draft === caption}
              >
                {saving ? "保存中…" : "保存说明"}
              </button>
            ) : null}
            {status ? <span style={{ fontSize: 12, color: "#555" }}>{status}</span> : null}
            <span style={{ fontSize: 11.5, color: "#888", marginLeft: "auto" }}>
              {[row.mimeType, formatBytes(row.byteSize ?? 0), new Date(row.updatedAt).toLocaleString()]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12.5, color: "#555" }}>地址</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={urlRef}
              className="admin-input"
              readOnly
              value={row.url}
              onFocus={(event) => event.target.select()}
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 11.5
              }}
            />
            <button type="button" className="admin-btn" onClick={() => void copy()} style={{ flex: "none" }}>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
