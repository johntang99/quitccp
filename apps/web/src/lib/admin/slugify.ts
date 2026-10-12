import { pinyin } from "pinyin-pro";

/**
 * Turns a Chinese title into the slug that becomes its public address.
 *
 * Editors write titles; nobody should have to hand-romanise one. Until now the
 * admin forms kept the Chinese characters in the slug, which produced addresses
 * that are unreadable once a browser encodes them --
 * `/boards/2026-10-10-361%E5%90%8D%E6%B3%95%E8%BC%AA%E5%8A%9F…` -- and cannot
 * be pasted into a chat window in one line.
 *
 * ## Why this runs on the server
 *
 * `pinyin-pro` unpacks to roughly a megabyte. Shipping it to the browser to
 * convert one title per save would be absurd, and the alternative -- a
 * character table, which is how `zh-variants.ts` solves the traditional/
 * simplified problem -- is wrong here for a reason that matters: a table reads
 * one character at a time, and Chinese pronunciation is contextual.
 *
 *     重庆  chong-qing   not  zhong-qing
 *     会计  kuai-ji      not  hui-ji
 *     银行  yin-hang     not  yin-xing
 *
 * `pinyin-pro` carries a phrase dictionary and gets those right. So the
 * conversion stays here and the admin form asks for it over the network.
 */

/** The admin's own date prefix, `2026-10-12-`, in the site's timezone. */
function datePrefix(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-`;
}

/**
 * ü has no place in a URL. Hanyu Pinyin only puts it after n and l (虐 nüe,
 * 绿 lü), and dropping the diaeresis is what every Chinese site does: nue, lu.
 */
function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface SlugOptions {
  /** Prepend `YYYY-MM-DD-`. The 资料 form offers this as a checkbox. */
  withDate?: boolean;
}

/**
 * The slug for a title. Returns "" when nothing survives, which the caller
 * should treat as "leave the field alone" rather than writing an empty slug.
 */
export function slugifyTitle(title: string, options: SlugOptions = {}): string {
  /* Traditional text goes in as it is. `pinyin-pro` reads both scripts, and
     首鋼煉鋼廠 and 首钢炼钢厂 already come back as the same `shougang-liangang
     -chang`, so the slug is stable whichever way a title was typed.

     Converting to simplified first was the obvious move and was wrong: the
     character table in `zh-variants.ts` maps 么 to its variant 幺, so 是什么
     came back `shi-shen-yao` instead of `shi-shen-me`. That table exists to
     widen a search, where an extra reading costs nothing; a slug wants the one
     correct reading, and the pinyin dictionary already has it. */
  const parts = pinyin(title.trim(), {
    toneType: "none",
    type: "array",
    nonZh: "consecutive"
  });

  const base = stripDiacritics(parts.join("-"))
    .toLowerCase()
    /* Everything that is not a letter, a digit or a separator goes. Chinese
       that pinyin-pro could not read (rare characters, 〇, emoji) falls in here
       and is dropped rather than left to be percent-encoded later. */
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) return "";
  return options.withDate ? `${datePrefix()}${trim(base)}` : trim(base);
}

/**
 * Keeps a slug to a readable length.
 *
 * Per-character pinyin is long: a 39-character headline romanises to 164. That
 * is not broken -- browsers and Postgres take it -- but it is unreadable in a
 * chat window and pointless, since nothing past the first few words tells a
 * reader anything they did not already get.
 *
 * Cut at a hyphen so the slug never ends mid-syllable: `…-zhong-guo` rather
 * than `…-zhong-gu`.
 */
function trim(base: string, limit = 80): string {
  if (base.length <= limit) return base;
  const cut = base.slice(0, limit);
  const lastBreak = cut.lastIndexOf("-");
  return (lastBreak > limit / 2 ? cut.slice(0, lastBreak) : cut).replace(/-+$/, "");
}
