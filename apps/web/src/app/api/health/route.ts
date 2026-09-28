import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

type HealthStatus = "ok" | "error" | "skipped";

interface HealthItem {
  status: HealthStatus;
  detail?: string;
}

function getPrimarySearchBackend(): "pg_trgm" | "meilisearch" {
  const raw = (process.env.SEARCH_PRIMARY_BACKEND ?? "pg_trgm").trim().toLowerCase();
  return raw === "meilisearch" ? "meilisearch" : "pg_trgm";
}

async function checkSupabase(): Promise<HealthItem> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("cms_articles")
      .select("id", { head: true, count: "exact" })
      .eq("locale", "zh")
      .limit(1);
    if (error) {
      return { status: "error", detail: `supabase query failed: ${error.message}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown supabase error" };
  }
}

async function checkMeilisearch(): Promise<HealthItem> {
  const host = process.env.MEILI_HOST?.trim();
  if (!host) return { status: "error", detail: "MEILI_HOST not set" };

  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/health`);
    if (!response.ok) {
      return { status: "error", detail: `meili health failed: ${response.status} ${response.statusText}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown meili error" };
  }
}

async function checkPgSearch(): Promise<HealthItem> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("search_articles_trgm", {
      p_query: "退党",
      p_locale: "zh",
      p_limit: 1,
      p_offset: 0
    });
    if (error) {
      return { status: "error", detail: `pg search rpc failed: ${error.message}` };
    }
    return { status: "ok" };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "unknown pg search error" };
  }
}

export async function GET() {
  const primarySearch = getPrimarySearchBackend();
  const [supabase, search] = await Promise.all([
    checkSupabase(),
    primarySearch === "meilisearch" ? checkMeilisearch() : checkPgSearch()
  ]);

  const ok = supabase.status === "ok" && search.status === "ok";
  return NextResponse.json(
    {
      ok,
      environment: process.env.NODE_ENV ?? "unknown",
      primarySearch,
      checks: {
        supabase,
        search
      },
      timestamp: new Date().toISOString()
    },
    { status: ok ? 200 : 503 }
  );
}
