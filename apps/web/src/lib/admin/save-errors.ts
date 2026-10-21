/**
 * What actually went wrong, in words an editor can act on.
 *
 * Supabase rejects with a plain `{ message, code }` object rather than an
 * Error, so `error instanceof Error` is false and every failure collapsed into
 * "保存失败。" -- including a statement timeout, which is the one an editor
 * only has to wait out and try again. Somebody editing a long article had no
 * way to tell a passing hiccup from a lost afternoon.
 */
import { t } from "@/lib/i18n";

export function explainSaveFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  const detail = error as { message?: string; code?: string } | null;
  const code = detail?.code ?? "";
  const message = detail?.message ?? "";
  if (code === "57014" || /statement timeout/i.test(message)) {
    return t("admin.save.timeout");
  }
  if (code === "23505" || /duplicate|unique/i.test(message)) {
    return t("admin.save.duplicate");
  }
  if (code === "23502") return t("admin.save.missingField", { detail: message });
  return message || t("admin.save.failed");
}
