import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { contentPathToRoutes } from "@/lib/content-paths";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { deleteContentFile, getContentFileByPath, upsertContentFile } from "@/lib/admin/content-repository";

function parseData(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("content must be a JSON object");
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (raw === undefined || raw === null) return {};
  throw new Error("content must be a JSON object");
}

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || "zh";
    const path = searchParams.get("path") || "";
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    const row = await getContentFileByPath(locale, path, user.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ row });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load content file" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  try {
    const body = (await request.json()) as {
      locale?: string;
      path?: string;
      content?: unknown;
      note?: string;
    };
    const locale = body.locale?.trim() || "zh";
    const path = body.path?.trim() || "";
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
    const data = parseData(body.content);
    const row = await upsertContentFile(locale, path, data, user.email, body.note?.trim() || undefined);

    // Drop the cached HTML for the page(s) this entry renders, so the edit is
    // live on the next request instead of waiting for the revalidate window.
    // Never let a cache miss fail the save itself.
    const revalidated: string[] = [];
    for (const route of contentPathToRoutes(path)) {
      try {
        if (route === "/layout") revalidatePath("/", "layout");
        else revalidatePath(route);
        revalidated.push(route);
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ row, revalidated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save content file" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || "zh";
    const path = searchParams.get("path") || "";
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    await deleteContentFile(locale, path, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete content file" },
      { status: 500 }
    );
  }
}
