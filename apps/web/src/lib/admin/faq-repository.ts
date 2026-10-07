/**
 * 常见问答 (FAQ) storage.
 *
 * Mirrors `material-repository` so the fourth content type behaves like the
 * first three. The one structural difference is that a FAQ belongs to exactly
 * one category: the old BetterDocs site models it that way, the public page
 * groups by it, and a join table would add a relation nothing queries across.
 *
 * Every read tolerates the table not existing yet (`ready: false`) rather than
 * throwing, so the admin can say "run migration 023" instead of showing a
 * stack trace.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export interface FaqCategoryRecord {
  id: string;
  slug: string;
  name: string;
  summary: string;
  sortOrder: number;
  count: number;
}

export interface FaqListRow {
  id: string;
  slug: string;
  question: string;
  categoryId: string;
  categoryName: string;
  position: number;
  status: string;
  updatedAt: string;
  updatedBy: string;
  answerChars: number;
}

export interface FaqRecord {
  id: string;
  slug: string;
  locale: string;
  question: string;
  answerMarkdown: string;
  categoryId: string;
  position: number;
  status: string;
  legacyId: number | null;
  legacyUrl: string;
}

/**
 * Local, because `repository.ts` keeps its own `createAudit` private and the
 * FAQ is not worth widening that module's surface for. Failures are swallowed:
 * an audit row that cannot be written must not stop an editor saving an answer.
 */
async function audit(actorEmail: string, action: string, targetId: string) {
  try {
    await createSupabaseAdminClient().from("cms_audit_logs").insert({
      actor_email: actorEmail,
      action,
      target_type: "faq",
      target_id: targetId,
      access_mode: "write",
      detail: {}
    });
  } catch {
    /* audit is a record, not a gate */
  }
}

const TABLE = "cms_faqs";
const CATEGORY_TABLE = "cms_faq_categories";

/** 42P01 is "relation does not exist"; PostgREST also answers PGRST205. */
function missingTable(error: unknown): boolean {
  const text = JSON.stringify(error ?? "");
  return /42P01|PGRST205|does not exist|schema cache/i.test(text);
}

export async function listFaqCategories(): Promise<{ ready: boolean; rows: FaqCategoryRecord[] }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CATEGORY_TABLE)
    .select("id, slug, name, summary, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    if (missingTable(error)) return { ready: false, rows: [] };
    throw error;
  }

  // Counted, not stored: the number beside a category on the public page is the
  // number of published answers in it.
  const { data: counted, error: countError } = await supabase
    .from(TABLE)
    .select("category_id, status")
    .eq("status", "published");
  if (countError && !missingTable(countError)) throw countError;

  const counts = new Map<string, number>();
  for (const row of counted ?? []) {
    const id = String((row as Record<string, unknown>).category_id ?? "");
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return {
    ready: true,
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      summary: String(row.summary ?? ""),
      sortOrder: Number(row.sort_order ?? 0),
      count: counts.get(String(row.id)) ?? 0
    }))
  };
}

export interface FaqSearchFilters {
  q?: string;
  category?: string;
  status?: string;
}

export async function searchFaqs(
  filters: FaqSearchFilters
): Promise<{ ready: boolean; rows: FaqListRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from(TABLE)
    .select("id, slug, question, answer_markdown, category_id, position, status, updated_at, updated_by", {
      count: "exact"
    });

  if (filters.q) query = query.ilike("question", `%${filters.q}%`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category_id", filters.category);

  // Grouped by category then by the order an editor set, which is how the page
  // reads -- a flat newest-first list would hide the ordering being edited.
  const { data, error, count } = await query
    .order("category_id", { ascending: true })
    .order("position", { ascending: true });
  if (error) {
    if (missingTable(error)) return { ready: false, rows: [], total: 0 };
    throw error;
  }

  const { rows: categories } = await listFaqCategories();
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    ready: true,
    total: count ?? 0,
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      question: String(row.question),
      categoryId: String(row.category_id ?? ""),
      categoryName: nameById.get(String(row.category_id ?? "")) ?? "未分类",
      position: Number(row.position ?? 0),
      status: String(row.status ?? "draft"),
      updatedAt: String(row.updated_at ?? ""),
      updatedBy: String(row.updated_by ?? ""),
      answerChars: String(row.answer_markdown ?? "").length
    }))
  };
}

export async function getFaq(id: string): Promise<FaqRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, slug, locale, question, answer_markdown, category_id, position, status, legacy_id, legacy_url")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw error;
  }
  if (!data) return null;
  return {
    id: String(data.id),
    slug: String(data.slug),
    locale: String(data.locale ?? "zh"),
    question: String(data.question),
    answerMarkdown: String(data.answer_markdown ?? ""),
    categoryId: String(data.category_id ?? ""),
    position: Number(data.position ?? 0),
    status: String(data.status ?? "draft"),
    legacyId: data.legacy_id === null || data.legacy_id === undefined ? null : Number(data.legacy_id),
    legacyUrl: String(data.legacy_url ?? "")
  };
}

export interface FaqInput {
  id?: string;
  slug: string;
  question: string;
  answerMarkdown: string;
  categoryId: string;
  position?: number;
  status: string;
}

export async function saveFaq(input: FaqInput, actorEmail: string): Promise<string> {
  const supabase = createSupabaseAdminClient();

  let position = input.position;
  if (position === undefined || Number.isNaN(position)) {
    // A new question goes to the end of its category rather than to the top:
    // the order is editorial, and silently displacing the first answer is not
    // something an editor asked for.
    const { data } = await supabase
      .from(TABLE)
      .select("position")
      .eq("category_id", input.categoryId)
      .order("position", { ascending: false })
      .limit(1);
    position = Number(data?.[0]?.position ?? -1) + 1;
  }

  const row: Record<string, unknown> = {
    slug: input.slug,
    question: input.question,
    // Browsers submit textarea content with CRLF line endings. The renderer
    // strips the \r anyway, but storing it makes every save differ from the
    // imported text by invisible characters.
    answer_markdown: input.answerMarkdown.replace(/\r\n?/g, "\n"),
    category_id: input.categoryId || null,
    position,
    status: input.status,
    updated_by: actorEmail
  };

  if (input.id) {
    const { error } = await supabase.from(TABLE).update(row).eq("id", input.id);
    if (error) throw error;
    await audit(actorEmail, "faq.update", input.id);
    return input.id;
  }

  row.created_by = actorEmail;
  const { data, error } = await supabase.from(TABLE).insert(row).select("id").single();
  if (error) throw error;
  const id = String(data.id);
  await audit(actorEmail, "faq.create", id);
  return id;
}

export async function deleteFaq(id: string, actorEmail: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  await audit(actorEmail, "faq.delete", id);
}

/**
 * Moves one question up or down inside its category.
 *
 * Swaps positions with its neighbour rather than renumbering the category, so
 * two editors reordering different parts of a long list do not fight.
 */
export async function moveFaq(id: string, direction: "up" | "down", actorEmail: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: current, error } = await supabase
    .from(TABLE)
    .select("id, category_id, position")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!current) return;

  const comparison = direction === "up" ? "lt" : "gt";
  const { data: neighbours } = await supabase
    .from(TABLE)
    .select("id, position")
    .eq("category_id", current.category_id)
    [comparison]("position", current.position)
    .order("position", { ascending: direction === "down" })
    .limit(1);
  const neighbour = neighbours?.[0];
  if (!neighbour) return;

  await supabase.from(TABLE).update({ position: Number(neighbour.position) }).eq("id", current.id);
  await supabase.from(TABLE).update({ position: Number(current.position) }).eq("id", neighbour.id);
  await audit(actorEmail, "faq.reorder", id);
}

export async function upsertFaqCategory(
  input: { id?: string; slug: string; name: string; summary: string; sortOrder: number },
  actorEmail: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const row = { slug: input.slug, name: input.name, summary: input.summary, sort_order: input.sortOrder };
  const { error } = input.id
    ? await supabase.from(CATEGORY_TABLE).update(row).eq("id", input.id)
    : await supabase.from(CATEGORY_TABLE).insert(row);
  if (error) throw error;
  await audit(actorEmail, "faq.category.save", input.slug);
}

export async function deleteFaqCategory(id: string, actorEmail: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // The questions survive: the foreign key is ON DELETE SET NULL, so they fall
  // into 未分类 rather than disappearing with the category.
  const { error } = await supabase.from(CATEGORY_TABLE).delete().eq("id", id);
  if (error) throw error;
  await audit(actorEmail, "faq.category.delete", id);
}
