"use client";

import { useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { formatBytes, uploadFile } from "@/lib/admin/upload-client";

/**
 * Upload a video file and write its public URL into the field beside it.
 *
 * The address box on its own assumed the editor already had a URL, which meant
 * knowing where to host a file and how to get a direct link to it -- a step this
 * admin does for every image but, until now, not for video.
 *
 * Two limits are enforced here rather than left to the server, because the
 * server's answer arrives only after the whole file has crossed the wire:
 *
 * - 200MB is the upload policy's ceiling and the request would be refused above
 *   it. Supabase itself accepts more -- 220MB was tested and stored -- so this
 *   is our rule, not the platform's.
 * - .mp4 and .webm are the only formats a browser plays inline. A .mov would
 *   upload perfectly and then show nothing, which is the worst outcome: a file
 *   that cost bandwidth and a hero that silently falls back to the poster.
 *
 * The soft advice about 3MB is separate and deliberately not enforced: a hero
 * backdrop is downloaded by every visitor, but an editor who has a reason to
 * exceed it should be warned, not blocked.
 */

const MAX_UPLOAD_MB = 200;
/** Over this, every visitor pays for it -- worth saying, not worth refusing. */
const SUGGESTED_MB = 3;

export function VideoUploadField({
  folder,
  onUploaded
}: {
  folder: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setStatus(null);

    const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
    if (extension !== "mp4" && extension !== "webm") {
      setStatus({
        tone: "error",
        text: t("admin.vidup.badFormat", {
          what: extension ? t("admin.vidup.badFormatWhat", { ext: extension }) : ""
        })
      });
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setStatus({
        tone: "error",
        text: t("admin.vidup.tooLarge", { size: formatBytes(file.size), mb: MAX_UPLOAD_MB })
      });
      return;
    }

    setBusy(true);
    setPercent(0);
    try {
      const result = await uploadFile(file, { folder, onProgress: setPercent });
      onUploaded(result.url);
      // Size is reported on success rather than before it, so the number shown
      // is the file that is actually now serving the homepage.
      setStatus(
        file.size > SUGGESTED_MB * 1024 * 1024
          ? {
              tone: "warn",
              text: t("admin.vidup.doneBig", { size: formatBytes(file.size), mb: SUGGESTED_MB })
            }
          : { tone: "ok", text: t("admin.vidup.done", { size: formatBytes(file.size) }) }
      );
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : t("admin.vidup.failed") });
    } finally {
      setBusy(false);
      // Cleared so picking the same file again still fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const tone = {
    ok: { color: "#246b3f", background: "#f1f8f3", border: "#bcdcc7" },
    warn: { color: "#8a5a1b", background: "#fdf6ec", border: "#e8cfa6" },
    error: { color: "#8a2b2b", background: "#fdf2f2", border: "#e9b8b8" }
  }[status?.tone ?? "ok"];

  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("admin.vidup.uploading", { n: percent }) : t("admin.vidup.button", { mb: MAX_UPLOAD_MB })}
        </button>
        <span style={{ color: "#777", fontSize: 12 }}>
          {t("admin.vidup.hint")}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          style={{ display: "none" }}
          onChange={(event) => void pick(event.target.files?.[0])}
        />
      </div>
      {busy ? (
        <div style={{ height: 4, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${percent}%`, height: "100%", background: "#4a3ca0" }} />
        </div>
      ) : null}
      {status ? (
        <p
          style={{
            margin: 0,
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.7,
            color: tone.color,
            background: tone.background,
            border: `1px solid ${tone.border}`
          }}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
