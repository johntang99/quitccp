/**
 * Sends an operational alert by email.
 *
 * ## Why Resend and not Supabase
 *
 * Supabase Auth already sends this project's only mail -- the password reset --
 * but it sends from its own templates to the address of an account that exists.
 * An alert is neither: arbitrary text, to whoever is on call. RESEND_API_KEY
 * was already in the environment and unused; this is the first thing to use it.
 *
 * The verified sending domains on that key belong to the other sites sharing
 * the account, so RESEND_FROM is a baamplatform.com address rather than
 * tuidang.org. That is fine for mail we send to ourselves and deliberately not
 * fine for anything a reader would receive -- do not reuse this for that.
 *
 * Never throws. An alert that crashes the job it was reporting on is worse than
 * no alert, so failures come back as `false` and are logged.
 */

export interface AlertEmail {
  subject: string;
  /** Plain text. Rendered as-is; alerts are read on a phone at 2am. */
  body: string;
}

export function alertRecipient(): string | null {
  return process.env.ALERT_EMAIL_TO?.trim() || null;
}

export async function sendAlertEmail(mail: AlertEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  const to = alertRecipient();
  if (!apiKey || !from || !to) {
    console.warn("[notify] skipped: RESEND_API_KEY / RESEND_FROM / ALERT_EMAIL_TO 未配齐");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, text: mail.body }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.warn(`[notify] resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[notify] resend failed: ${error instanceof Error ? error.message : "unknown"}`);
    return false;
  }
}
