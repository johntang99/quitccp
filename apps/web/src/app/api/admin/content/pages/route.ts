import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { listPages, upsertPageRecord } from "@/lib/admin/repository";

export async function GET() {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listPages(user.email);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const section = String(formData.get("section") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");
  const status = String(formData.get("status") ?? "draft") as
    | "draft"
    | "review"
    | "published"
    | "archived";
  const blocksJson = String(formData.get("blocksJson") ?? "[]");

  await upsertPageRecord({ id, section, slug, title, locale: "zh", status, blocksJson }, user.email);
  return NextResponse.redirect(new URL("/admin/content", request.url), 303);
}
