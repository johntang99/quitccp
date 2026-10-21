import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";
import { importPrototypeContent, upsertContentFile } from "@/lib/admin/content-repository";
import { revalidatePath } from "next/cache";
import { contentPathToRoutes } from "@/lib/content-paths";
import { SITE_LOCALE } from "@/lib/site-config";

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

/** Clears the cached HTML for whatever pages these content entries render. */
function revalidateContentPaths(paths: Iterable<string>) {
  for (const path of paths) {
    for (const route of contentPathToRoutes(path)) {
      try {
        if (route === "/layout") revalidatePath("/", "layout");
        else revalidatePath(route);
      } catch {
        /* The import already succeeded; a cache will expire on its own. */
      }
    }
  }
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
    const locale = body.locale?.trim() || SITE_LOCALE;
    const overwrite = Boolean(body.overwrite);
    const mode = body.mode || "prototype";

    if (mode === "manual") {
      const entries = parseEntries(body.entries);
      let imported = 0;
      for (const entry of entries) {
        await upsertContentFile(locale, entry.path, entry.data, user.email, "manual-import");
        imported += 1;
      }
      /* An import rewrites page content wholesale, so the cached HTML for every
         page it touched is wrong. Named per entry rather than clearing the whole
         site: the paths are right here, and `revalidatePath("/", "layout")`
         would drop all 15,374 article caches for an import of three pages. */
      revalidateContentPaths(entries.map((entry) => entry.path));
      return NextResponse.json({ imported, mode, locale });
    }

    const result = await importPrototypeContent(locale, user.email, overwrite);
    /* The prototype import does not report which paths it wrote, so this is the
       one case that has to clear everything the content system can render. */
    revalidatePath("/", "layout");
    return NextResponse.json({ ...result, mode, locale, overwrite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import content" },
      { status: 500 }
    );
  }
}
