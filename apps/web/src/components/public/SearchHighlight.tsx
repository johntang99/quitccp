import { Fragment } from "react";
import { splitTerms, termVariants } from "@/lib/search-substring";

/**
 * Marks the searched words inside a title or excerpt.
 *
 * Every form a term was matched by is highlighted, not just what the reader
 * typed: someone searching 退黨 sees 退党 marked in a simplified article, and
 * someone searching 三退 sees 退党 marked where the synonym is what actually
 * matched. Otherwise the highlighting would quietly contradict the result -- a
 * row returned for a query with nothing marked in it reads like a mistake.
 *
 * Text is split and rendered as React nodes rather than assembled into an HTML
 * string. Article titles and summaries are editor-supplied, and building markup
 * from them by hand is how a search page becomes an injection point.
 */
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const pattern = buildPattern(query);
  if (!pattern || !text) return <>{text}</>;

  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, index) =>
        // split() with a capturing group puts the matches at the odd indices.
        index % 2 === 1 ? (
          <mark key={index}>{part}</mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(query: string): RegExp | null {
  const forms = new Set<string>();
  for (const term of splitTerms(query)) {
    for (const form of termVariants(term)) {
      if (form.trim()) forms.add(form);
    }
  }
  if (forms.size === 0) return null;
  // Longest first, so 九评共产党 is marked whole rather than leaving 共产党
  // dangling outside the mark that 九评 opened.
  const alternatives = [...forms]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  try {
    return new RegExp(`(${alternatives})`, "gi");
  } catch {
    return null;
  }
}
