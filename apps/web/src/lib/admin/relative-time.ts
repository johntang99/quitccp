import { t } from "@/lib/i18n";

/**
 * 「3 小时前」这类相对时间。
 *
 * 放在这里是因为总览页和登记册面板都要用，而它带文案 —— 散成两份就会出现
 * 一处说「小时前」另一处说「个小时前」。
 */
export function ago(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return t("admin.ago.minutes", { n: Math.max(1, Math.round(hours * 60)) });
  if (hours < 48) return t("admin.ago.hours", { n: hours.toFixed(1) });
  return t("admin.ago.days", { n: Math.round(hours / 24) });
}
