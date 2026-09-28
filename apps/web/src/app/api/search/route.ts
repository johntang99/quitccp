import { NextResponse } from "next/server";
import { pgTrgmSearchSql } from "@/lib/search";
import { searchPublishedArticlesWithMeta } from "@/lib/search-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const locale = searchParams.get("locale") ?? "zh";
  const limit = Number(searchParams.get("limit") ?? "20");
  const execution = await searchPublishedArticlesWithMeta(query, { locale, limit });

  return NextResponse.json({
    query,
    locale,
    baseline: "dual_read",
    backend: execution.meta.effectiveBackend,
    primaryBackend: execution.meta.primaryBackend,
    dualReadEnabled: execution.meta.dualReadEnabled,
    sqlTemplate: pgTrgmSearchSql.trim(),
    results: execution.results
  });
}
