"use client";

import { useState } from "react";

/**
 * 立即发布 — forces the public pages to rebuild instead of waiting out the
 * five-minute ISR window.
 */
export function RevalidateButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/content/revalidate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg(`已刷新 ${new Date(json.at).toLocaleTimeString("zh-CN")}`);
    } catch (err) {
      setMsg(`刷新失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button className="admin-btn admin-btn-primary" type="button" onClick={run} disabled={busy}>
        {busy ? "刷新中…" : "立即发布"}
      </button>
      {msg ? <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>{msg}</span> : null}
    </span>
  );
}
