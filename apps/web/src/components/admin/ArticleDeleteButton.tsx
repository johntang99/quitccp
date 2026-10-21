"use client";

import { useEffect, useRef, useState } from "react";
import { DeleteImpact } from "./DeleteImpact";
import { t } from "@/lib/i18n";

/**
 * Delete one article, behind a confirmation that names it.
 *
 * The button sits two columns from 编辑 in a dense list, so a misclick has to
 * cost nothing. The dialog states what will go and makes 取消 the default: it
 * takes focus on open, Escape closes, and clicking the backdrop closes. Only
 * the red button in the dialog submits.
 *
 * Deletion is a real form POST rather than a fetch, so it still works if this
 * component never hydrates, and the endpoint's redirect reloads the list.
 */
export function ArticleDeleteButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        className="admin-btn admin-btn-sm admin-btn-danger"
        type="button"
        style={{ marginLeft: 4 }}
        onClick={() => setOpen(true)}
      >
        {t("admin.art.delete")}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`del-h-${id}`}
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
              width: "min(520px, 100%)",
              padding: "20px 22px 18px",
              maxHeight: "min(86vh, 720px)",
              overflowY: "auto",
              boxShadow: "0 18px 48px rgba(18,13,45,.28)"
            }}
          >
            <h3 id={`del-h-${id}`} style={{ margin: "0 0 10px", fontSize: 17 }}>
              {t("admin.art.delete.title")}
            </h3>
            <p style={{ margin: "0 0 6px", lineHeight: 1.6, wordBreak: "break-word" }}>
              {t("admin.art.delete.name", { title })}
            </p>
            <p style={{ margin: "0 0 12px", color: "#8a90a0", fontSize: 13, lineHeight: 1.6 }}>
              {t("admin.art.delete.warning")}
            </p>
            {/* 对话框一打开就查，不等第二次点击 —— 这正是「铁证如山」32 集被删时
                没人看见的那句话。 */}
            <DeleteImpact kind="article" id={id} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="admin-btn"
                type="button"
                ref={cancelRef}
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                {t("admin.cancel")}
              </button>
              <form
                method="post"
                action="/api/admin/content/articles/delete"
                onSubmit={() => setSubmitting(true)}
              >
                <input type="hidden" name="id" value={id} />
                <button className="admin-btn admin-btn-danger" type="submit" disabled={submitting}>
                  {t(submitting ? "admin.art.delete.deleting" : "admin.art.delete.confirm")}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
