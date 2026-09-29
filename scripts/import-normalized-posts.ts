import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { HOLDING_CATEGORY, categoryNames, type NormalizedArticle } from "./migrate-wp-posts";

interface InputFile {
  rows: NormalizedArticle[];
}

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function categoryNameFromSlug(slug: string): string {
  // Prefer the Chinese name; the title-cased slug is only a last resort for a
  // category nobody has named yet, and it is visible in the admin immediately.
  if (categoryNames[slug]) return categoryNames[slug];
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const filePath = process.argv[2];
  const mode = process.argv[3] ?? "--dry-run";
  const updateExisting = process.argv.includes("--update-existing");
  const batchSizeArgIndex = process.argv.indexOf("--batch-size");
  const batchSizeArg =
    batchSizeArgIndex > -1 && process.argv[batchSizeArgIndex + 1]
      ? Number(process.argv[batchSizeArgIndex + 1])
      : undefined;
  const batchSize = Number.isFinite(batchSizeArg) && (batchSizeArg as number) > 0 ? Number(batchSizeArg) : 20;
  if (!filePath) {
    throw new Error(
      "Usage: tsx scripts/import-normalized-posts.ts <normalized-json> [--apply|--dry-run] [--batch-size <n>] [--update-existing]"
    );
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as InputFile;
  const rows = parsed.rows ?? [];

  // A row with no category either sits only in categories we deliberately
  // excluded (视频系列 / 未分类 / temp), or in one the table does not know about.
  // The first is an intended outcome and is simply left out; the second means
  // the table is incomplete and must stop the import.
  // No category at all means the old category is missing from `taxonomyMap`.
  // Anything we have consciously decided not to file yet already carries the
  // holding category, so this is genuinely an incomplete table -- stop.
  const unknown = rows.filter((row) => !row.category?.trim());
  if (unknown.length > 0) {
    const sample = unknown
      .slice(0, 5)
      .map((row) => `${row.legacyId} [${(row.wpCategories ?? []).join(",") || "无分类"}] ${row.title.slice(0, 20)}`);
    throw new Error(
      [
        `${unknown.length} 篇文章的旧分类不在对照表里，导入中止。`,
        ...sample.map((line) => `  ${line}`),
        "把这些旧分类补进 scripts/migrate-wp-posts.ts 的 taxonomyMap 后重试。"
      ].join("\n")
    );
  }

  const held = rows.filter((row) => row.category === HOLDING_CATEGORY.category).length;
  if (held > 0) {
    console.error(`[import] ${held} 篇进入「待归类」，URL 照常可用，之后在后台批量改分类。`);
  }

  const categorySlugs = Array.from(new Set(rows.map((row) => row.category))).sort();
  const summary = {
    totalRows: rows.length,
    uniqueLegacyIds: new Set(rows.map((row) => row.legacyId)).size,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    categories: categorySlugs
  };

  if (mode !== "--apply") {
    process.stdout.write(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
    return;
  }

  const supabase = createClient(assertEnv("SUPABASE_URL"), assertEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });

  // Create only the categories that do not exist yet.
  //
  // This used to upsert every slug with `categoryNameFromSlug(slug)` as the
  // name, which is how the categories ended up called "Red Regime Collapse" in
  // the first place -- and a re-import would have overwritten the Chinese names
  // an editor has since set. Existing rows are now left alone.
  const { data: existingCats, error: existingCatError } = await supabase
    .from("cms_article_categories")
    .select("slug")
    .in("slug", categorySlugs);
  if (existingCatError) throw existingCatError;
  const known = new Set((existingCats ?? []).map((row) => String(row.slug)));
  const missing = categorySlugs.filter((slug) => !known.has(slug));
  if (missing.length > 0) {
    console.error(`[import] creating ${missing.length} new categories: ${missing.join(", ")}`);
    const { error: categoryError } = await supabase
      .from("cms_article_categories")
      .insert(missing.map((slug) => ({ slug, name: categoryNameFromSlug(slug) })));
    if (categoryError) throw categoryError;
  }

  const { data: categoryRows, error: categoryReadError } = await supabase
    .from("cms_article_categories")
    .select("id, slug")
    .in("slug", categorySlugs);
  if (categoryReadError) throw categoryReadError;
  const categoryBySlug = new Map((categoryRows ?? []).map((row) => [String(row.slug), String(row.id)]));

  let imported = 0;
  const timedOut: string[] = [];
  const articleBySlug = new Map<string, string>();

  async function upsertArticlesAdaptive(
    payload: Array<Record<string, unknown>>,
    batchStart: number,
    batchEnd: number
  ): Promise<void> {
    const { error } = await supabase
      .from("cms_articles")
      .upsert(payload, updateExisting ? { onConflict: "slug,locale" } : { onConflict: "slug,locale", ignoreDuplicates: true });
    if (!error) return;

    const code = (error as { code?: string }).code;
    if (code === "57014" && payload.length > 1) {
      const middle = Math.ceil(payload.length / 2);
      await upsertArticlesAdaptive(payload.slice(0, middle), batchStart, batchStart + middle - 1);
      await upsertArticlesAdaptive(payload.slice(middle), batchStart + middle, batchEnd);
      return;
    }

    // A single row timing out is usually transient load, not a bad row. Halving
    // has nowhere left to go, so back off and retry before giving up -- one slow
    // row used to abort the whole import at 3,040 of 15,514.
    if (code === "57014" && payload.length === 1) {
      for (const waitMs of [2000, 5000, 15000]) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const retry = await supabase
          .from("cms_articles")
          .upsert(payload, updateExisting ? { onConflict: "slug,locale" } : { onConflict: "slug,locale", ignoreDuplicates: true });
        if (!retry.error) return;
      }
      timedOut.push(String((payload[0] as { slug?: string }).slug ?? batchStart));
      console.error(`[import] 跳过超时的一行：${(payload[0] as { slug?: string }).slug}`);
      return;
    }

    throw new Error(
      JSON.stringify(
        {
          phase: "article_upsert",
          batchStart,
          batchEnd,
          code,
          message: (error as { message?: string }).message
        },
        null,
        2
      )
    );
  }

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    // The editorial columns have to be written here too. They were added to the
    // admin's save path only, so a bulk import produced 15,514 articles with no
    // cover, no caption and no photo credit even though the data carried them.
    const payload = batch.map((row) => ({
      slug: row.slug,
      locale: row.locale,
      title: row.title,
      summary: row.summary,
      body_markdown: row.bodyMarkdown,
      body_plain: row.bodyPlain,
      section: row.section,
      status: "published",
      editorial_status: "published",
      legacy_url: row.legacyUrl,
      legacy_id: row.legacyId,
      published_at: row.publishedAt,
      hero_image: row.heroImage ?? "",
      hero_image_alt: row.heroImageAlt ?? "",
      hero_credit: row.heroCredit ?? ""
    }));
    await upsertArticlesAdaptive(payload, i, i + batch.length - 1);

    imported += batch.length;
    if (imported % 1000 === 0 || imported === rows.length) {
      // eslint-disable-next-line no-console
      console.error(`[import-progress] articles ${imported}/${rows.length}`);
    }
  }

  // Resolve IDs for all target rows (inserted and existing) using compact numeric legacy ids.
  const uniqueLegacyIds = Array.from(new Set(rows.map((row) => row.legacyId)));
  const articleByLegacyId = new Map<number, string>();
  for (let i = 0; i < uniqueLegacyIds.length; i += 400) {
    const legacyChunk = uniqueLegacyIds.slice(i, i + 400);
    const { data: articleRows, error: lookupError } = await supabase
      .from("cms_articles")
      .select("id, legacy_id")
      .eq("locale", "zh")
      .in("legacy_id", legacyChunk);
    if (lookupError) {
      throw new Error(
        JSON.stringify(
          {
            phase: "article_lookup",
            chunkStart: i,
            chunkEnd: i + legacyChunk.length - 1,
            code: (lookupError as { code?: string }).code,
            message: (lookupError as { message?: string }).message
          },
          null,
          2
        )
      );
    }
    for (const row of articleRows ?? []) {
      const legacyId = Number((row as { legacy_id?: number | null }).legacy_id);
      if (Number.isFinite(legacyId)) {
        articleByLegacyId.set(legacyId, String(row.id));
      }
    }
  }

  for (const row of rows) {
    const articleId = articleByLegacyId.get(row.legacyId);
    if (articleId) {
      articleBySlug.set(row.slug, articleId);
    }
  }

  // Ensure category map is deterministic and idempotent for imported article set.
  const uniqueArticleIds = Array.from(new Set(articleBySlug.values()));
  if (uniqueArticleIds.length > 0) {
    for (let i = 0; i < uniqueArticleIds.length; i += 100) {
      const chunk = uniqueArticleIds.slice(i, i + 100);
      const { error: deleteMapError } = await supabase
        .from("cms_article_category_map")
        .delete()
        .in("article_id", chunk);
      if (deleteMapError) {
        throw new Error(
          JSON.stringify(
            {
              phase: "category_map_delete",
              chunkStart: i,
              chunkEnd: i + chunk.length - 1,
              code: (deleteMapError as { code?: string }).code,
              message: (deleteMapError as { message?: string }).message
            },
            null,
            2
          )
        );
      }
      if ((i + chunk.length) % 2000 === 0 || i + chunk.length >= uniqueArticleIds.length) {
        // eslint-disable-next-line no-console
        console.error(`[import-progress] category-map-delete ${Math.min(i + chunk.length, uniqueArticleIds.length)}/${uniqueArticleIds.length}`);
      }
    }
  }

  const mappingRows: Array<{ article_id: string; category_id: string }> = [];

  for (const row of rows) {
    const articleId = articleBySlug.get(row.slug);
    const categoryId = categoryBySlug.get(row.category);
    if (articleId && categoryId) {
      mappingRows.push({ article_id: articleId, category_id: categoryId });
    }
  }

  for (let i = 0; i < mappingRows.length; i += 100) {
    const chunk = mappingRows.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { error: mapError } = await supabase
      .from("cms_article_category_map")
      .upsert(chunk, { onConflict: "article_id,category_id" });
    if (mapError) {
      throw new Error(
        JSON.stringify(
          {
            phase: "category_map_upsert",
            chunkStart: i,
            chunkEnd: i + chunk.length - 1,
            code: (mapError as { code?: string }).code,
            message: (mapError as { message?: string }).message
          },
          null,
          2
        )
      );
    }
    if ((i + chunk.length) % 2000 === 0 || i + chunk.length >= mappingRows.length) {
      // eslint-disable-next-line no-console
      console.error(`[import-progress] category-map-upsert ${Math.min(i + chunk.length, mappingRows.length)}/${mappingRows.length}`);
    }
  }

  if (timedOut.length > 0) {
    console.error(`[import] 有 ${timedOut.length} 行因超时被跳过，可重跑本脚本补上：`);
    for (const slug of timedOut.slice(0, 10)) console.error(`  ${slug}`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        mode: "apply",
        ...summary,
        importedRows: imported,
        mappedRows: mappingRows.length,
        resolvedArticleIds: uniqueArticleIds.length,
        updateExisting
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const payload =
    error && typeof error === "object"
      ? {
          message: "message" in error ? (error as { message?: unknown }).message : undefined,
          details: "details" in error ? (error as { details?: unknown }).details : undefined,
          hint: "hint" in error ? (error as { hint?: unknown }).hint : undefined,
          code: "code" in error ? (error as { code?: unknown }).code : undefined
        }
      : { message: String(error) };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
});
