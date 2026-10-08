"use client";

import { useEffect, useRef, useState } from "react";

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
        删除
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
              width: "min(440px, 100%)",
              padding: "20px 22px 18px",
              boxShadow: "0 18px 48px rgba(18,13,45,.28)"
            }}
          >
            <h3 id={`del-h-${id}`} style={{ margin: "0 0 10px", fontSize: 17 }}>
              删除这篇文章？
            </h3>
            <p style={{ margin: "0 0 6px", lineHeight: 1.6, wordBreak: "break-word" }}>
              《{title}》
            </p>
            <p style={{ margin: "0 0 18px", color: "#8a90a0", fontSize: 13, lineHeight: 1.6 }}>
              删除后文章将从网站上消失，原链接变成 404。此操作无法在后台撤销。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="admin-btn"
                type="button"
                ref={cancelRef}
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                取消
              </button>
              <form
                method="post"
                action="/api/admin/content/articles/delete"
                onSubmit={() => setSubmitting(true)}
              >
                <input type="hidden" name="id" value={id} />
                <button className="admin-btn admin-btn-danger" type="submit" disabled={submitting}>
                  {submitting ? "正在删除…" : "确认删除"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
