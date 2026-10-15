"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Runs the defence checks now, instead of waiting for the hourly schedule.
 *
 * The panel beside it shows the last stored run, so this is what you press
 * after fixing something: it re-measures, stores the result, and reloads the
 * panel. An admin session authorises the cron route, so it is the same code
 * path the schedule takes -- not a second implementation that could disagree.
 *
 * `?test=1` additionally mails the current state whatever it is, which is the
 * only way to prove the alert plumbing works without first breaking something.
 */
export function SelfCheckButton() {
  const [busy, setBusy] = useState<"" | "check" | "mail">("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function run(test: boolean) {
    setBusy(test ? "mail" : "check");
    setMsg("");
    try {
      const res = await fetch(`/api/cron/selfcheck${test ? "?test=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (test) {
        setMsg(
          json.sent
            ? `测试邮件已发往 ${json.to}`
            : `没发出去：检查 Vercel 里的 RESEND_API_KEY、RESEND_FROM、ALERT_EMAIL_TO`
        );
      } else {
        setMsg("已重新检查");
      }
      router.refresh();
    } catch (err) {
      setMsg(`失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button className="admin-btn admin-btn-sm" type="button" disabled={!!busy} onClick={() => run(false)}>
        {busy === "check" ? "检查中…" : "立即检查"}
      </button>
      <button
        className="admin-btn admin-btn-sm"
        type="button"
        disabled={!!busy}
        onClick={() => run(true)}
        title="发一封测试邮件，确认报警链路通畅"
      >
        {busy === "mail" ? "发送中…" : "试发报警邮件"}
      </button>
      {msg ? <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>{msg}</span> : null}
    </span>
  );
}
