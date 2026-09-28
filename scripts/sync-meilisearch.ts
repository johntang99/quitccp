import { createClient } from "@supabase/supabase-js";

interface SearchDocument {
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

interface MeiliTask {
  taskUid: number;
  status: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseIntArg(argv: string[], name: string, fallback: number): number {
  const idx = argv.indexOf(name);
  if (idx < 0) return fallback;
  const raw = Number(argv[idx + 1]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function parseLocales(argv: string[]): string[] {
  const idx = argv.indexOf("--locales");
  if (idx < 0) return ["zh"];
  const raw = argv[idx + 1] ?? "zh";
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
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
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  const response = await fetch(`${host.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meilisearch ${method} ${path} failed: ${response.status} ${response.statusText} ${text}`);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return (await response.json()) as T;
}

async function waitForTask(host: string, apiKey: string, taskUid: number, timeoutMs = 300000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const task = await meiliRequest<MeiliTask>(host, apiKey, "GET", `/tasks/${taskUid}`);
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
      rankingRules: [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness"
      ]
    }
  );
  await waitForTask(host, apiKey, task.taskUid);
}

async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseIntArg(args, "--batch-size", 200);
  const locales = parseLocales(args);

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  const meiliHost = requireEnv("MEILI_HOST");
  const meiliKey = process.env.MEILI_MASTER_KEY?.trim() || process.env.MEILI_SEARCH_API_KEY?.trim() || "";
  const indexUid = process.env.MEILI_INDEX_ARTICLES?.trim() || "articles";

  await ensureIndex(meiliHost, meiliKey, indexUid);
  await configureIndex(meiliHost, meiliKey, indexUid);

  let offset = 0;
  let totalIndexed = 0;
  let lastTaskUid: number | null = null;

  while (true) {
    const { data, error } = await supabase
      .from("cms_articles")
      .select("id, slug, title, summary, body_plain, section, locale, status, published_at")
      .in("locale", locales)
      .order("legacy_id", { ascending: true })
      .range(offset, offset + batchSize - 1);
    if (error) throw error;

    const rows = (data ?? []) as SearchDocument[];
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
    offset += rows.length;

    // eslint-disable-next-line no-console
    console.error(`[meili-sync] queued ${totalIndexed} docs`);

    if (rows.length < batchSize) break;
  }

  if (lastTaskUid !== null) {
    await waitForTask(meiliHost, meiliKey, lastTaskUid);
  }

  process.stdout.write(
    JSON.stringify(
      {
        index: indexUid,
        locales,
        totalIndexed
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
