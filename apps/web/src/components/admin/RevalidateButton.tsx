"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { formatTime } from "@/lib/format";

/**
 * Drops every cached public page at once. A last resort, not a publish step.
 *
 * Every save now clears what it touched -- articles, videos, stored pages,
 * materials, categories, the FAQ, a restored revision. So nothing an editor
 * does needs this any more, and it is no longer offered to them.
 *
 * What it costs, measured 2026-10-14: after `revalidatePath("/", "layout")`
 * the next request for a page is a MISS, not a stale copy refreshed in the
 * background. Every page anyone then asks for blocks on a full database
 * render. With 15,374 articles and an attack still running, that is the shape
 * of the thing that took Postgres down on 2026-10-13.
 *
 * It used to be labelled 立即发布 and styled as the primary action, which made
 * it look like the normal way to publish -- the obvious thing to press when
 * your change has not appeared. That is why it reads as a repair tool now, and
 * asks before it runs.
 */
export function RevalidateButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    const ok = window.confirm(
      t("admin.revalidate.confirm")
    );
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/content/revalidate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg(t("admin.revalidate.done", { at: formatTime(json.at) }));
    } catch (err) {
      setMsg(t("admin.revalidate.failed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button className="admin-btn" type="button" onClick={run} disabled={busy} title={t("admin.revalidate.title")}>
        {t(busy ? "admin.revalidate.busy" : "admin.revalidate.label")}
      </button>
      {msg ? <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>{msg}</span> : null}
    </span>
  );
}
