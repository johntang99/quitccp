import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { importPrototypeContent, upsertContentFile } from "@/lib/admin/content-repository";

function parseEntries(raw: unknown): Array<{ path: string; data: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const path = typeof row?.path === "string" ? row.path.trim() : "";
      const data = row?.data;
      if (!path || !data || typeof data !== "object" || Array.isArray(data)) return null;
      return { path, data: data as Record<string, unknown> };
    })
    .filter((row): row is { path: string; data: Record<string, unknown> } => Boolean(row));
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  try {
    const body = (await request.json()) as {
      locale?: string;
      overwrite?: boolean;
      mode?: "prototype" | "manual";
      entries?: Array<{ path: string; data: Record<string, unknown> }>;
    };
    const locale = body.locale?.trim() || "zh";
    const overwrite = Boolean(body.overwrite);
    const mode = body.mode || "prototype";

    if (mode === "manual") {
      const entries = parseEntries(body.entries);
      let imported = 0;
      for (const entry of entries) {
        await upsertContentFile(locale, entry.path, entry.data, user.email, "manual-import");
        imported += 1;
      }
      return NextResponse.json({ imported, mode, locale });
    }

    const result = await importPrototypeContent(locale, user.email, overwrite);
    return NextResponse.json({ ...result, mode, locale, overwrite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import content" },
      { status: 500 }
    );
  }
}
