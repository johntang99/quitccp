"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The 更新 and 删除 pair at the end of a category row -- video, article, or
 * whatever gets this treatment next.
 *
 * Modelled on MaterialCategoryDeleteButton, which already solved the delete
 * half for material categories; the difference is that this one also owns the
 * save button, so the two can share a row and the same width.
 *
 * Generalised the moment the second caller appeared. The two differ only in
 * where the delete posts and what the category holds -- 视频 or 篇文章 -- so
 * those are props rather than a second copy of the dialog, the focus handling
 * and the pending state.
 *
 * ## Why 更新 lives here and not in the form
 *
 * The row's inputs sit in several table cells and are tied to one <form> by
 * `form={id}` -- a form cannot span table cells. The submit button could stay
 * in the form, but then nothing would report that a save was under way: this
 * is an ordinary POST with a full page navigation, which on a slow connection
 * looks exactly like a click that did nothing, and the usual answer to that is
 * to click again.
 *
 * So the button listens to its form's `submit` event. That event fires only
 * after the browser's own validation passes, which a plain `onClick` does not
 * know about -- a click on a row with an empty name would otherwise leave the
 * button stuck on 保存中… forever.
 */
export function CategoryRowActions({
  formId,
  id,
  name,
  count,
  deleteAction,
  /** 「视频」/「篇文章」 -- what the blocking message counts. */
  unit,
  /** What disappears with the row, named in the confirmation. */
  alsoLost = "分类页的说明文字会一并消失。"
}: {
  formId: string;
  id: string;
  name: string;
  count: number;
  deleteAction: string;
  unit: string;
  alsoLost?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const blocked = count > 0;

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    /* Only fires once validation has passed; see the note above. */
    const onSubmit = () => setSaving(true);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [formId]);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`delvc-h-${id}`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,13,45,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 20
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 6,
          width: "min(440px, 100%)",
          padding: "20px 22px 18px",
          boxShadow: "0 18px 48px rgba(18,13,45,.28)"
        }}
      >
        <h3 id={`delvc-h-${id}`} style={{ margin: "0 0 10px", fontSize: 17 }}>
          {blocked ? "这个分类还不能删" : "删除这个分类？"}
        </h3>
        <p style={{ margin: "0 0 6px", lineHeight: 1.6, wordBreak: "break-word" }}>「{name}」</p>
        <p style={{ margin: "0 0 18px", color: "#8a90a0", fontSize: 13, lineHeight: 1.6 }}>
          {blocked
            ? `下面还有 ${count} ${unit}。请先把它们改到别的分类，再回来删。`
            : `这个分类下面没有${unit.replace(/^篇/, "")}，删掉不影响任何页面。${alsoLost}`}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="admin-btn"
            type="button"
            ref={cancelRef}
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            {blocked ? "知道了" : "取消"}
          </button>
          {blocked ? null : (
            /* Its own two fields, not the row's form: that form carries the
               editor's unsaved edits, and a delete has no business sending
               them. Portalled to <body> for the same reason as the material
               one -- a form nested in a form is illegal HTML. */
            <form
              method="post"
              action={deleteAction}
              onSubmit={() => setDeleting(true)}
            >
              <input type="hidden" name="id" value={id} />
              <button className="admin-btn admin-btn-danger" type="submit" disabled={deleting}>
                {deleting ? "正在删除…" : "确认删除"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Equal widths via `flex: 1`, so neither action reads as the main one.
          Deleting a category is not a lesser act than saving it. */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="admin-btn"
          type="submit"
          form={formId}
          disabled={saving}
          style={{ flex: 1, justifyContent: "center" }}
        >
          {saving ? "保存中…" : "更新"}
        </button>
        <button
          className="admin-btn admin-btn-danger"
          type="button"
          onClick={() => setOpen(true)}
          disabled={saving}
          style={{ flex: 1, justifyContent: "center" }}
          title={blocked ? `还有 ${count} ${unit}在这个分类下，不能删` : "删除这个分类"}
        >
          删除
        </button>
      </div>
      {open && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </>
  );
}
