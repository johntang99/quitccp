import { listArticles, listCategories } from "@/lib/admin/repository";

/**
 * Shared lookups for the article form: the category list it offers, and the
 * bylines already in use.
 *
 * Authors come from recent articles rather than a maintained table -- the
 * editor writes their own name, and the list just stops the same person being
 * recorded three different ways.
 */
export async function getArticleFormLookups(actorEmail: string) {
  const [categories, recent] = await Promise.all([
    listCategories(actorEmail),
    listArticles({ page: 1, pageSize: 200 }, actorEmail)
  ]);
  const authors = Array.from(
    new Set(recent.rows.map((row) => row.author?.trim()).filter((name): name is string => Boolean(name)))
  ).sort();
  return {
    categories: categories.map((row) => ({ name: row.name, slug: row.slug })),
    authors
  };
}
