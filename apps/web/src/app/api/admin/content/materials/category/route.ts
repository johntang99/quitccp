import { NextResponse } from "next/server";
import { upsertMaterialCategory } from "@/lib/admin/material-repository";
import { guardMaterialWrite } from "@/lib/admin/material-guard";

/** Create or rename a material category. */
export async function POST(request: Request) {
  const { error } = await guardMaterialWrite();
  if (error) return error;

  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const back = (msg: string, key: "msg" | "error") =>
    NextResponse.redirect(new URL(`/admin/material-categories?${key}=${encodeURIComponent(msg)}`, request.url), 303);

  if (!slug || !name) return back("名称和 slug 都要填。", "error");
  // The slug goes in the public URL, so it has to survive being one.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return back("slug 只能用小写英文、数字和短横线，例如 kind-words。", "error");
  }

  try {
    await upsertMaterialCategory({
      id: String(form.get("id") ?? "").trim() || undefined,
      slug,
      name,
      summary: String(form.get("summary") ?? "").trim(),
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0
    });
  } catch (err) {
    /*
     * Supabase rejects with a plain `{ message, code }` object, not an Error, so
     * `err instanceof Error` is false and every failure read as "保存失败" --
     * including the duplicate slug, which is the one an editor can actually fix.
     */
    const detail = err as { message?: string; code?: string } | null;
    const message = detail?.message ?? "保存失败";
    if (detail?.code === "23505" || /duplicate|unique/i.test(message)) {
      return back(`slug「${slug}」已经被别的分类用了，换一个。`, "error");
    }
    return back(message, "error");
  }
  return back(`已保存「${name}」。`, "msg");
}
