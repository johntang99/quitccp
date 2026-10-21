"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { createPortal } from "react-dom";

/**
 * Delete one material category, behind a confirmation that names it.
 *
 * It sits next to 保存 in a dense row of inputs, where a misclick is easy, so
 * the dialog states what goes and makes 取消 the default: it takes focus on
 * open, Escape closes, and clicking the backdrop closes.
 *
 * A category still holding published material is refused by the endpoint --
 * material with no category vanishes from the download page -- and the button
 * says so up front rather than letting the editor find out by round-trip.
 *
 * It posts its own two fields rather than submitting the row's form: that form
 * carries the editor's unsaved edits to the name and sort order, and a delete
 * has no business sending them.
 *
 * The dialog is portalled to <body> because the trigger sits inside the row's
 * form, and a form nested in a form is illegal HTML -- React reports it as a
 * hydration error and the browser drops the inner one.
 */
export function MaterialCategoryDeleteButton({ id, name, count }: { id: string; name: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const blocked = count > 0;

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
      aria-labelledby={`delcat-h-${id}`}
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
        <h3 id={`delcat-h-${id}`} style={{ margin: "0 0 10px", fontSize: 17 }}>
          {t(blocked ? "admin.mcat.cannotDelete" : "admin.mcat.confirmDelete")}
        </h3>
        <p style={{ margin: "0 0 6px", lineHeight: 1.6, wordBreak: "break-word" }}>「{name}」</p>
        <p style={{ margin: "0 0 18px", color: "#8a90a0", fontSize: 13, lineHeight: 1.6 }}>
          {blocked
            ? t("admin.mcat.blockedBody", { n: count })
            : t("admin.mcat.emptyBody")}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="admin-btn"
            type="button"
            ref={cancelRef}
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            {t(blocked ? "admin.mcat.understood" : "admin.cancel")}
          </button>
          {blocked ? null : (
            <form
              method="post"
              action="/api/admin/content/materials/category/delete"
              onSubmit={() => setSubmitting(true)}
            >
              <input type="hidden" name="id" value={id} />
              <button className="admin-btn admin-btn-danger" type="submit" disabled={submitting}>
                {t(submitting ? "admin.list.delete.deleting" : "admin.list.delete.confirm")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="admin-btn admin-btn-danger"
        type="button"
        onClick={() => setOpen(true)}
        title={blocked ? t("admin.mcat.deleteBlockedTitle", { n: count }) : t("admin.mcat.deleteTitle")}
      >
        {t("admin.list.delete")}
      </button>
      {open && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </>
  );
}
