/**
 * What actually went wrong, in words an editor can act on.
 *
 * Supabase rejects with a plain `{ message, code }` object rather than an
 * Error, so `error instanceof Error` is false and every failure collapsed into
 * "保存失败。" -- including a statement timeout, which is the one an editor
 * only has to wait out and try again. Somebody editing a long article had no
 * way to tell a passing hiccup from a lost afternoon.
 */
export function explainSaveFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  const detail = error as { message?: string; code?: string } | null;
  const code = detail?.code ?? "";
  const message = detail?.message ?? "";
  if (code === "57014" || /statement timeout/i.test(message)) {
    return "数据库这会儿忙不过来，这次没存上。稍等几秒再按一次「保存」——内容还在页面上，不会丢。";
  }
  if (code === "23505" || /duplicate|unique/i.test(message)) {
    return "有重复的网址或编号，换一个再存。";
  }
  if (code === "23502") return `有必填字段是空的：${message}`;
  return message || "保存失败。";
}
