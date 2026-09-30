"use client";

import { useEffect, useRef, useState } from "react";

interface MediaItem {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
}

interface ImagePickerModalProps {
  open: boolean;
  /** Human-readable name of the field being filled, shown in the header. */
  fieldLabel?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}

const MAX_UPLOAD_MB = 5;

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

/**
 * Library + upload picker for image fields.
 *
 * Uploads go to Supabase Storage and are indexed in `cms_media_assets`; the
 * content JSON only ever receives the resulting public URL. A URL can also be
 * pasted directly, which is how the existing tuidang.org images are referenced.
 */
export function ImagePickerModal({ open, fieldLabel, onClose, onSelect }: ImagePickerModalProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploadEnabled, setUploadEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadLibrary = async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/media/list");
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(String(payload.error || "读取媒体库失败"));
      setItems((payload.items as MediaItem[]) ?? []);
      setUploadEnabled(payload.uploadEnabled !== false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取媒体库失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadLibrary();
    // Intentionally only on open: re-running on every render would refetch the
    // library while the operator is looking at it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleUpload = async (file: File) => {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setStatus(`文件过大，请上传小于 ${MAX_UPLOAD_MB}MB 的图片。`);
      return;
    }
    setUploading(true);
    setStatus("正在上传…");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "home");
      const response = await fetch("/api/admin/media/upload", { method: "POST", body });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(String(payload.error || "上传失败"));
      onSelect(String(payload.url));
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(`删除「${item.name}」？引用了这张图片的页面会失去图片。`)) return;
    try {
      const response = await fetch("/api/admin/media/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(String(payload.error || "删除失败"));
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除失败");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="选择图片"
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
          width: "min(900px, 100%)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <div className="admin-toolbar" style={{ margin: 0, padding: "12px 16px", borderBottom: "1px solid #ececec" }}>
          <strong>选择图片{fieldLabel ? ` — ${fieldLabel}` : ""}</strong>
          <button className="admin-btn" type="button" onClick={loadLibrary} disabled={loading}>
            刷新
          </button>
          {/* A real button that opens the picker itself, rather than a <label>
              wrapping a display:none input and relying on the browser to
              forward the click. That pattern works in some browsers and
              silently does nothing in others -- and a hidden input is also
              invisible to the accessibility tree, so the control announced
              itself as an anonymous piece of text rather than a button. */}
          <button
            className="admin-btn"
            type="button"
            disabled={!uploadEnabled || uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? "上传中…" : `上传图片（≤ ${MAX_UPLOAD_MB}MB）`}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            // Off-screen rather than display:none: a hidden input cannot always
            // be opened programmatically, and Safari in particular ignores it.
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <button className="admin-btn" type="button" onClick={onClose} style={{ marginLeft: "auto" }}>
            关闭
          </button>
        </div>

        {!uploadEnabled ? (
          <p style={{ margin: 0, padding: "10px 16px", color: "#8a6d1f", fontSize: 13 }}>
            未配置 SUPABASE_STORAGE_BUCKET，暂时无法上传；可在下方直接填写图片地址。
          </p>
        ) : null}
        {status ? (
          <p role="status" style={{ margin: 0, padding: "10px 16px", color: "#b42318", fontSize: 13 }}>
            {status}
          </p>
        ) : null}

        <div style={{ padding: "12px 16px", borderBottom: "1px solid #ececec", display: "flex", gap: 8 }}>
          <input
            className="admin-input"
            style={{ flex: 1 }}
            placeholder="或直接粘贴图片地址 https://…"
            value={pastedUrl}
            onChange={(event) => setPastedUrl(event.target.value)}
          />
          <button
            className="admin-btn admin-btn-primary"
            type="button"
            disabled={!pastedUrl.trim()}
            onClick={() => {
              onSelect(pastedUrl.trim());
              setPastedUrl("");
              onClose();
            }}
          >
            使用此地址
          </button>
        </div>

        <div style={{ overflow: "auto", padding: 16 }}>
          {loading ? (
            <p>正在加载…</p>
          ) : items.length === 0 ? (
            <p style={{ color: "#666" }}>媒体库还没有图片。点击上方「上传图片」添加。</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 12
              }}
            >
              {items.map((item) => (
                <div key={item.id} style={{ border: "1px solid #ececec", borderRadius: 4, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item.url);
                      onClose();
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: 0,
                      border: 0,
                      background: "none",
                      cursor: "pointer",
                      lineHeight: 0
                    }}
                    title={item.name}
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
                    />
                  </button>
                  <div style={{ padding: "6px 8px", display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#555",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1
                      }}
                    >
                      {item.name}
                    </span>
                    <button
                      className="admin-btn"
                      type="button"
                      style={{ padding: "2px 6px", fontSize: 12 }}
                      onClick={() => handleDelete(item)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
