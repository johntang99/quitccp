import { NextResponse } from "next/server";
import { deleteMaterialCategory, listMaterialCategories } from "@/lib/admin/material-repository";
import { guardMaterialWrite } from "@/lib/admin/material-guard";

/**
 * Delete a material category.
 *
 * Refused while anything is still filed under it. Unlike an article category,
 * a material with no category disappears from the downloads page entirely, so
 * deleting one out from under its files would hide them rather than just
 * leave them unsorted.
 */
export async function POST(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const back = (msg: string, key: "msg" | "error") =>
    NextResponse.redirect(new URL(`/admin/material-categories?${key}=${encodeURIComponent(msg)}`, request.url), 303);

  if (!id) return back("缺少分类 id。", "error");

  const { rows } = await listMaterialCategories();
  const target = rows.find((r) => r.id === id);
  if (!target) return back("这个分类已经不存在了。", "error");
  if (target.count > 0) {
    return back(`「${target.name}」下面还有 ${target.count} 份已发布资料，请先把它们改到别的分类。`, "error");
  }

  await deleteMaterialCategory(id);
  return back(`已删除「${target.name}」。`, "msg");
}
