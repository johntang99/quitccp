import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { getDefenseStatus, saveDefenseReport, type DefenseCheck } from "@/lib/admin/defense-status";
import { alertRecipient, sendAlertEmail } from "@/lib/notify";

/**
 * Runs the defence checks on a schedule and mails when something breaks.
 *
 * The dashboard panel shows the same checks, from the same function, but it
 * only shows them to somebody who opens it. Everything this guards against is
 * silent by nature -- a page that quietly went dynamic again, an environment
 * variable lost in a redeploy, a migration rolled back -- so the thing that
 * notices has to run whether or not anyone is looking.
 *
 * ## Why it does not mail on every failing run
 *
 * An hourly job that mails whenever something is wrong sends 24 messages for
 * one broken thing, and after the second day nobody opens them. So it mails on
 * transitions and not on states:
 *
 *   - a problem that was not in the previous run    -> mail
 *   - the same problem, 24 hours later              -> mail, once a day
 *   - the same problem, any sooner                  -> nothing
 *   - everything healthy after something was broken -> mail, "recovered"
 *
 * Only `bad` counts. `warn` is for things that are off because somebody turned
 * them off -- the attack challenge, after the attack -- and an alert that fires
 * on an intended change is how people learn to ignore alerts.
 *
 * The previous run's verdict lives in cms_site_settings, which is already a
 * service-role-only key/value table, so this needs no migration. It does mean
 * the key shows up in /admin/settings alongside the editable ones; it is
 * harmless there, and arguably better than hiding it.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const STATE_KEY = "ops.selfcheck.state";
const REMINDER_HOURS = 24;

interface AlertState {
  /** Sorted, so two runs can be compared as strings. */
  badKeys: string[];
  notifiedAt: string;
}

async function authorise(request: Request): Promise<string | null> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return null;
  /* An admin session is also accepted, so the dashboard can trigger a run and
     so a human can prove the mail plumbing works without waiting an hour. */
  const user = await getAdminSessionUser();
  if (user) return null;
  return secret ? "Unauthorized" : "CRON_SECRET is not configured";
}

async function readState(): Promise<AlertState> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("cms_site_settings")
      .select("value_json")
      .eq("setting_key", STATE_KEY)
      .maybeSingle();
    const value = data?.value_json as Partial<AlertState> | undefined;
    return {
      badKeys: Array.isArray(value?.badKeys) ? (value!.badKeys as string[]) : [],
      notifiedAt: typeof value?.notifiedAt === "string" ? value.notifiedAt : ""
    };
  } catch {
    /* Treated as "nothing was wrong last time". The cost of being wrong here is
       one extra mail, which is the right direction to fail in. */
    return { badKeys: [], notifiedAt: "" };
  }
}

async function writeState(state: AlertState): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("cms_site_settings")
      .upsert(
        { setting_key: STATE_KEY, value_json: state, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
      );
  } catch (error) {
    console.warn(`[selfcheck] 状态写入失败：${error instanceof Error ? error.message : "未知"}`);
  }
}

function describe(checks: DefenseCheck[]): string {
  return checks
    .map((c) => {
      const mark = c.state === "ok" ? "正常" : c.state === "bad" ? "出问题" : c.state === "warn" ? "注意" : "测不到";
      return `[${mark}] ${c.label}：${c.value}`;
    })
    .join("\n");
}

function composeMail(
  kind: "new" | "reminder" | "recovered",
  bad: DefenseCheck[],
  all: DefenseCheck[]
): { subject: string; body: string } {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.tuidang.org";
  const dashboard = `${site}/admin/dashboard`;
  const when = new Date().toLocaleString("zh-CN", { timeZone: "UTC" }) + " UTC";

  if (kind === "recovered") {
    return {
      subject: "[tuidang.org] 已恢复正常",
      body:
        `之前报告的问题已经消失，现在全部检查都通过。\n\n检查时间：${when}\n\n` +
        `${describe(all)}\n\n后台：${dashboard}\n`
    };
  }

  const head =
    kind === "new"
      ? `tuidang.org 的防护检查发现 ${bad.length} 项出问题。`
      : `tuidang.org 的以下问题已经持续超过 ${REMINDER_HOURS} 小时，还没有恢复。`;

  const detail = bad
    .map((c, i) => `${i + 1}. ${c.label}：${c.value}\n   ${c.remedy ?? "（没有进一步说明）"}`)
    .join("\n\n");

  return {
    subject:
      kind === "new"
        ? `[tuidang.org] ${bad.map((c) => c.label).join("、")} 出问题`
        : `[tuidang.org] 仍未恢复：${bad.map((c) => c.label).join("、")}`,
    body:
      `${head}\n\n检查时间：${when}\n\n--- 出问题的项 ---\n\n${detail}\n\n` +
      `--- 全部检查 ---\n\n${describe(all)}\n\n后台：${dashboard}\n`
  };
}

export async function GET(request: Request) {
  const denied = await authorise(request);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const report = await getDefenseStatus();
  /* Stored before any mail is decided: the dashboard panel reads this, and it
     should show the latest measurement even on a run that mails nothing. */
  await saveDefenseReport(report);
  const bad = report.checks.filter((c) => c.state === "bad");
  const badKeys = bad.map((c) => c.key).sort();

  const previous = await readState();
  const changed = badKeys.join(",") !== previous.badKeys.join(",");
  const sinceNotice = previous.notifiedAt
    ? (Date.now() - new Date(previous.notifiedAt).getTime()) / 3_600_000
    : Infinity;

  let kind: "new" | "reminder" | "recovered" | null = null;
  if (badKeys.length > 0) {
    if (changed) kind = "new";
    else if (sinceNotice >= REMINDER_HOURS) kind = "reminder";
  } else if (previous.badKeys.length > 0) {
    kind = "recovered";
  }

  /* `?test=1` mails the current state whatever it is, so the plumbing can be
     proven on demand. It deliberately does not touch the stored state. */
  const forced = new URL(request.url).searchParams.get("test") === "1";
  if (forced && !kind) {
    const mail = composeMail(bad.length > 0 ? "new" : "recovered", bad, report.checks);
    const sent = await sendAlertEmail({
      subject: `${mail.subject}（手动测试）`,
      body: `这是一封手动触发的测试邮件，用来确认报警链路通畅。\n\n${mail.body}`
    });
    return NextResponse.json({ ok: true, test: true, sent, to: alertRecipient(), report });
  }

  let sent = false;
  if (kind) {
    sent = await sendAlertEmail(composeMail(kind, bad, report.checks));
  }

  if (kind === "recovered") {
    await writeState({ badKeys: [], notifiedAt: "" });
  } else if (kind) {
    await writeState({ badKeys, notifiedAt: new Date().toISOString() });
  } else if (changed) {
    /* Nothing worth mailing, but the set moved -- keep the record honest. */
    await writeState({ badKeys, notifiedAt: previous.notifiedAt });
  }

  return NextResponse.json({
    ok: report.worst !== "bad",
    worst: report.worst,
    alert: kind,
    mailed: sent,
    recipient: alertRecipient(),
    checks: report.checks,
    checkedAt: report.checkedAt
  });
}
