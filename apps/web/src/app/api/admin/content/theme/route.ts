import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { upsertSettingRecord } from "@/lib/admin/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { THEME_SETTING_KEY, loadTheme, mergeTheme } from "@/lib/public-theme";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ theme: await loadTheme() });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Merge over the defaults before storing, so a malformed or partial payload can
  // never leave the site with missing tokens.
  const theme = mergeTheme((body as { theme?: unknown })?.theme);
  await upsertSettingRecord(
    { settingKey: THEME_SETTING_KEY, valueJson: JSON.stringify(theme) },
    user.email
  );
  return NextResponse.json({ ok: true, theme });
}

/** Reverting to the shipped defaults is deleting the row, not writing defaults into it. */
export async function DELETE() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cms_site_settings")
    .delete()
    .eq("setting_key", THEME_SETTING_KEY);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, theme: await loadTheme() });
}
