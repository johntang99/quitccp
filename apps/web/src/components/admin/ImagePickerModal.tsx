"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { formatBytes, uploadFile } from "@/lib/admin/upload-client";

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

/**
 * 200MB, matching the shared upload policy.
 *
 * The old ceiling was 5MB and enforced here only. That was both too small for
 * a print-resolution 展板 and quietly broken: the bytes went through our own API
 * route, and a serverless request body is capped around 4.5MB in production --
 * so a 4.6MB image passed this check and then died at the edge, before the code
 * that would have explained why ever ran. Uploads now go browser -> Storage
 * directly and never cross a function.
 */
const MAX_UPLOAD_MB = 200;

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
  // A large image takes long enough that a label alone reads as a hang.
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  /*
   * Saying what a failed load means.
   *
   * Opening this costs two database round trips -- 500 rows plus an audit
   * entry -- so when the database is briefly busy it answers "Too many
   * connections issued to the database", in English, straight from Supabase.
   * An editor reading that cannot tell it is a passing hiccup, nor that
   * 刷新 will very likely clear it, nor that uploading still works.
   */
  const explainLoadFailure = (error: unknown) => {
    const raw = error instanceof Error ? error.message : "";
    if (/too many connections/i.test(raw)) {
      return t("admin.pick.busy");
    }
    return raw || t("admin.pick.readFailed");
  };

  const loadLibrary = async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/media/list");
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(String(payload.error || t("admin.pick.readFailedShort")));
      setItems((payload.items as MediaItem[]) ?? []);
      setUploadEnabled(payload.uploadEnabled !== false);
    } catch (error) {
        setStatus(explainLoadFailure(error));
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
      setStatus(t("admin.pick.tooLarge", { mb: MAX_UPLOAD_MB }));
      return;
    }
    setUploading(true);
    setProgress(0);
    setStatus(t("admin.pick.uploadingSize", { size: formatBytes(file.size) }));
    try {
      const result = await uploadFile(file, { folder: "home", onProgress: setProgress });
      onSelect(result.url);
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.pick.uploadFailed"));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(t("admin.pick.confirmDelete", { name: item.name }))) return;
    try {
      const response = await fetch("/api/admin/media/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(String(payload.error || t("admin.pick.deleteFailed")));
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.pick.deleteFailed"));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.pick.aria")}
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
          <strong>
            {fieldLabel ? t("admin.pick.titleWithField", { field: fieldLabel }) : t("admin.pick.title")}
          </strong>
          <button className="admin-btn" type="button" onClick={loadLibrary} disabled={loading}>
            {t("admin.pick.refresh")}
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
            {uploading
              ? t("admin.pick.uploading", { n: progress ?? 0 })
              : t("admin.pick.upload", { mb: MAX_UPLOAD_MB })}
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
            {t("admin.pick.close")}
          </button>
        </div>

        {!uploadEnabled ? (
          <p style={{ margin: 0, padding: "10px 16px", color: "#8a6d1f", fontSize: 13 }}>
            {t("admin.pick.noBucket")}
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
            placeholder={t("admin.pick.urlPlaceholder")}
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
            {t("admin.pick.useUrl")}
          </button>
        </div>

        <div style={{ overflow: "auto", padding: 16 }}>
          {loading ? (
            <p>{t("admin.pick.loading")}</p>
          ) : items.length === 0 ? (
            <p style={{ color: "#666" }}>{t("admin.pick.empty")}</p>
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
                      {t("admin.pick.delete")}
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
