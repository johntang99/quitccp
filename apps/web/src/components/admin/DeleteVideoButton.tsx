"use client";

/**
 * Delete, behind a confirmation naming the video.
 *
 * A bare submit button one row away from 编辑 is too easy to hit by accident,
 * and a deleted video takes its category mapping and its legacy redirect with it.
 */
export function DeleteVideoButton({ title }: { title: string }) {
  return (
    <button
      className="admin-btn admin-btn-sm admin-btn-danger"
      type="submit"
      onClick={(event) => {
        if (!window.confirm(`删除《${title}》？此操作无法撤销。`)) event.preventDefault();
      }}
    >
      删除
    </button>
  );
}
