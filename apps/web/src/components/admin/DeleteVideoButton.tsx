"use client";

import { useEffect, useRef, useState } from "react";
import { DeleteImpact } from "./DeleteImpact";

/**
 * Delete one video, behind a confirmation that names it.
 *
 * A bare submit button one row away from 编辑 is too easy to hit by accident,
 * and a deleted video takes its category mapping and its legacy redirect with it.
 *
 * 从 window.confirm 改成自己的对话框，是为了放下「删掉会牵连什么」那一段 ——
 * 原生确认框只能显示一行纯文本，装不下一份清单。照 ArticleDeleteButton 的样子
 * 写：取消拿焦点、Escape 关、点背景关，只有红色按钮会提交。
 *
 * 表单在对话框里，所以调用方不要再往外面套一层 form —— 嵌套的 form 在浏览器里
 * 会被静默丢掉一层，提交的就不是你以为的那个。
 */
export function DeleteVideoButton({ id, title }: { id: string; title: string }) {
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
        onClick={() => setOpen(true)}
      >
        删除
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delv-h-${id}`}
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
              boxShadow: "0 18px 48px rgba(18,13,45,.28)",
              textAlign: "left"
            }}
          >
            <h3 id={`delv-h-${id}`} style={{ margin: "0 0 10px", fontSize: 17 }}>
              删除这支视频？
            </h3>
            <p style={{ margin: "0 0 6px", lineHeight: 1.6, wordBreak: "break-word" }}>
              《{title}》
            </p>
            <p style={{ margin: "0 0 12px", color: "#8a90a0", fontSize: 13, lineHeight: 1.6 }}>
              删除后视频将从网站上消失，原链接变成 404。此操作无法在后台撤销。
            </p>
            <DeleteImpact kind="video" id={id} />
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
                action="/api/admin/content/videos/delete"
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
