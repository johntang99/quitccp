import { NextResponse } from "next/server";
import { getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { listSettings, upsertSettingRecord } from "@/lib/admin/repository";
import { readFormData } from "@/lib/admin/form-request";
import { revalidatePath, revalidateTag } from "next/cache";
import { SITE_CHROME_TAG } from "@/lib/site-chrome-cache";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listSettings(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "settings.write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await readFormData(request);
  if (!formData) {
    return NextResponse.json({ error: "Expected form data" }, { status: 400 });
  }
  const id = String(formData.get("id") ?? "");
  const settingKey = String(formData.get("settingKey") ?? "").trim();
  const valueJson = String(formData.get("valueJson") ?? "{}");
  if (!settingKey) return NextResponse.json({ error: "settingKey is required" }, { status: 400 });

  await upsertSettingRecord({ id, settingKey, valueJson }, user.email);

  /*
   * `site.theme` and `site.nav` are the chrome on every page, and they are now
   * cached across requests, so a save has to drop the tag or the editor would
   * keep seeing the old menu for an hour. The pages that already rendered it
   * have it baked into their HTML, which is why the paths go too.
   */
  revalidateTag(SITE_CHROME_TAG);
  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/admin/settings", request.url), 303);
}
