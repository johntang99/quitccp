import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { adminCanWrite, getAdminSessionUser, requireAdminMfa } from "@/lib/admin/auth";

interface SearchDocumentRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_plain: string;
  section: string;
  locale: string;
  status: string;
  published_at: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function meiliRequest<T>(
  host: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${host.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meilisearch ${method} ${path} failed: ${response.status} ${response.statusText} ${text}`);
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

async function waitForTask(host: string, apiKey: string, taskUid: number, timeoutMs = 300000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const task = await meiliRequest<{ status: string }>(host, apiKey, "GET", `/tasks/${taskUid}`);
    if (task.status === "succeeded") return;
    if (task.status === "failed" || task.status === "canceled") {
      throw new Error(`Meilisearch task ${taskUid} ended with status ${task.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for Meilisearch task ${taskUid}`);
}

async function ensureIndex(host: string, apiKey: string, indexUid: string) {
  try {
    await meiliRequest(host, apiKey, "POST", "/indexes", {
      uid: indexUid,
      primaryKey: "id"
    });
  } catch (error) {
    const message = String(error);
    if (!message.includes("index_already_exists")) throw error;
  }
}

async function configureIndex(host: string, apiKey: string, indexUid: string) {
  const task = await meiliRequest<{ taskUid: number }>(
    host,
    apiKey,
    "PATCH",
    `/indexes/${encodeURIComponent(indexUid)}/settings`,
    {
      searchableAttributes: ["title", "summary", "body_plain"],
      filterableAttributes: ["locale", "status", "section"],
      sortableAttributes: ["published_at"],
      rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"]
    }
  );
  await waitForTask(host, apiKey, task.taskUid);
}

async function syncMeilisearch(locales: string[], batchSize: number): Promise<{ totalIndexed: number; index: string }> {
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const meiliHost = requireEnv("MEILI_HOST");
  const meiliKey = process.env.MEILI_MASTER_KEY?.trim() || process.env.MEILI_SEARCH_API_KEY?.trim() || "";
  const indexUid = process.env.MEILI_INDEX_ARTICLES?.trim() || "articles";

  await ensureIndex(meiliHost, meiliKey, indexUid);
  await configureIndex(meiliHost, meiliKey, indexUid);

  /*
   * Keyset pagination, not OFFSET.
   *
   * `.range(offset, …)` makes Postgres walk every skipped row, so the cost grows
   * with each batch until the statement times out. That is not theoretical: it
   * is why this index held 10,000 of 15,515 articles and had not moved since
   * 2026-08-13 -- the sync died around offset 7,500 every time it was run, and
   * the failure looked like an error message rather than a short index.
   *
   * Ordering by id (the primary key, unique and never null) also makes the walk
   * stable; `legacy_id` is null on anything created in this CMS, so rows could be
   * visited twice or skipped entirely.
   */
  let cursor: string | null = null;
  let totalIndexed = 0;
  let lastTaskUid: number | null = null;

  while (true) {
    let query = supabase
      .from("cms_articles")
      .select("id, slug, title, summary, body_plain, section, locale, status, published_at")
      .in("locale", locales)
      .order("id", { ascending: true })
      .limit(batchSize);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as SearchDocumentRow[];
    if (rows.length === 0) break;

    const task = await meiliRequest<{ taskUid: number }>(
      meiliHost,
      meiliKey,
      "POST",
      `/indexes/${encodeURIComponent(indexUid)}/documents`,
      rows
    );
    lastTaskUid = task.taskUid;
    totalIndexed += rows.length;
    cursor = String(rows[rows.length - 1].id);

    if (rows.length < batchSize) break;
  }

  if (lastTaskUid !== null) {
    await waitForTask(meiliHost, meiliKey, lastTaskUid);
  }

  return { totalIndexed, index: indexUid };
}

function parseLocales(raw: string): string[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseBatchSize(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 200;
  return Math.floor(parsed);
}

export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCanWrite(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  requireAdminMfa(user);

  const formData = await request.formData();
  const localesInput = String(formData.get("locales") ?? "zh");
  const batchSizeInput = String(formData.get("batchSize") ?? "200");
  const locales = parseLocales(localesInput);
  const batchSize = parseBatchSize(batchSizeInput);
  if (locales.length === 0) {
    return NextResponse.redirect(new URL("/admin/settings?searchSync=error&message=missing_locales", request.url), 303);
  }

  try {
    const result = await syncMeilisearch(locales, batchSize);
    const redirectUrl = new URL("/admin/settings", request.url);
    redirectUrl.searchParams.set("searchSync", "ok");
    redirectUrl.searchParams.set("indexed", String(result.totalIndexed));
    redirectUrl.searchParams.set("index", result.index);
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    const redirectUrl = new URL("/admin/settings", request.url);
    redirectUrl.searchParams.set("searchSync", "error");
    redirectUrl.searchParams.set("message", message.slice(0, 240));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
