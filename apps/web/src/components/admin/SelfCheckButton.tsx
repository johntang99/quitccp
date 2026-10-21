"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
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
            ? t("admin.selfcheck.mailSent", { to: json.to })
            : t("admin.selfcheck.mailFailed")
        );
      } else {
        setMsg(t("admin.selfcheck.rechecked"));
      }
      router.refresh();
    } catch (err) {
      setMsg(t("admin.selfcheck.failed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy("");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button className="admin-btn admin-btn-sm" type="button" disabled={!!busy} onClick={() => run(false)}>
        {t(busy === "check" ? "admin.selfcheck.checking" : "admin.selfcheck.checkNow")}
      </button>
      <button
        className="admin-btn admin-btn-sm"
        type="button"
        disabled={!!busy}
        onClick={() => run(true)}
        title={t("admin.selfcheck.mailTitle")}
      >
        {t(busy === "mail" ? "admin.selfcheck.sending" : "admin.selfcheck.sendMail")}
      </button>
      {msg ? <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>{msg}</span> : null}
    </span>
  );
}
