import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { readFormData } from "@/lib/admin/form-request";
import { syncSearchIndex } from "@/lib/search-index";

/**
 * 重建搜索索引 — the manual full sync in 站点设置.
 *
 * The document shape, pagination and index settings all live in lib/search-index
 * so this, the cron and the save-time hook cannot drift apart.
 */
export const maxDuration = 300;

function parseLocales(raw: string): string[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseBatchSize(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return Math.floor(parsed);
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await readFormData(request);
  if (!formData) return NextResponse.json({ error: "Expected form data" }, { status: 400 });

  const locales = parseLocales(String(formData.get("locales") ?? "zh"));
  const batchSize = parseBatchSize(String(formData.get("batchSize") ?? "300"));
  // Offered because a change to the document shape leaves the old documents
  // behind under their previous ids, and they would never be overwritten.
  const reset = String(formData.get("reset") ?? "") === "1";

  const back = (params: Record<string, string>) => {
    const url = new URL("/admin/settings", request.url);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  if (locales.length === 0) return back({ searchSync: "error", message: "missing_locales" });

  try {
    const result = await syncSearchIndex({ locales, batchSize, reset });
    return back({
      searchSync: "ok",
      indexed: String(result.total),
      articles: String(result.byType.article),
      videos: String(result.byType.video),
      materials: String(result.byType.material),
      index: result.index
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    return back({ searchSync: "error", message: message.slice(0, 240) });
  }
}
