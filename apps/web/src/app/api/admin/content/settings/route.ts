import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { listSettings, upsertSettingRecord } from "@/lib/admin/repository";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listSettings(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const settingKey = String(formData.get("settingKey") ?? "").trim();
  const valueJson = String(formData.get("valueJson") ?? "{}");
  if (!settingKey) return NextResponse.json({ error: "settingKey is required" }, { status: 400 });

  await upsertSettingRecord({ id, settingKey, valueJson }, user.email);
  return NextResponse.redirect(new URL("/admin/settings", request.url), 303);
}
