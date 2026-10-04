/**
 * Words this archive uses interchangeably.
 *
 * Every group here was measured against the corpus before being added, because a
 * synonym list is a precision/recall trade and guessing at it makes search worse
 * rather than better. The counts below are articles whose body contains the
 * second term but not the first -- that is, what a reader searching the first
 * term was missing:
 *
 *   三退      → 退党        1,573 articles
 *   ENDCCP   → 打倒中共恶魔    145
 *   中共      → 共产党        535
 *   三退      → 退团          165
 *   活摘      → 强摘           25
 *
 * Groups are symmetric: any member finds every other. Expansion happens at query
 * time and rides the same OR mechanism as the 繁簡 variants, so nothing is stored
 * and the list can change without reindexing anything.
 *
 * Kept deliberately short. Each entry widens what a search returns, and a group
 * that is merely topically related -- 迫害 and 酷刑, say -- would bury the pieces
 * someone actually asked for under ones they did not.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // The organisation's central term, and the three acts it stands for.
  ["三退", "退党", "退团", "退队"],
  // The petition is referred to by its English name as often as its Chinese one.
  ["ENDCCP", "END CCP", "打倒中共恶魔"],
  ["活摘", "强摘", "活体摘取"],
  ["中共", "共产党", "中国共产党"],
  ["法轮功", "法轮大法"],
  ["九评", "九评共产党"],
  ["大纪元", "大纪元时报"]
];

/**
 * term -> every member of every group it belongs to.
 *
 * Built once at module load. Keys are lowercased so an English synonym matches
 * however it was typed; Han characters are unaffected by case folding.
 */
const SYNONYM_INDEX: Map<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      const key = term.toLowerCase();
      const existing = index.get(key) ?? [];
      for (const other of group) if (!existing.includes(other)) existing.push(other);
      index.set(key, existing);
    }
  }
  return index;
})();

/**
 * The synonyms of a term, including the term itself.
 *
 * Only whole-term matches expand. Matching substrings instead would make 退党团
 * drag in every group that mentions 退党, which is not what anyone typing it
 * meant.
 */
export function synonymsOf(term: string): string[] {
  return SYNONYM_INDEX.get(term.trim().toLowerCase()) ?? [term];
}
