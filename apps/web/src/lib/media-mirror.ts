/**
 * Where media is served from, and the one rewrite that moves it.
 *
 * The site's images, audio and PDFs were written into the database as Supabase
 * Storage URLs -- 6,289 rows across the media columns, 62 article bodies and 25
 * page entries. Every one of them sends a reader's browser to
 * sukwifqplsyhbwmlfuti.supabase.co, which means media traffic is charged against
 * the same project quota the database lives in, and an attacker who learns one
 * of those URLs can spend that quota for us.
 *
 * The mirror on R2 holds the same bytes under the same keys, behind Cloudflare,
 * where egress is free and the edge cache answers almost everything. This turns
 * the stored URL into the mirror's URL on the way out.
 *
 * ## Why rewriting on the way out, rather than migrating the rows
 *
 * Because it is reversible. Unset NEXT_PUBLIC_MEDIA_MIRROR_HOST and every page
 * goes back to Supabase on the next render, with nothing in the database having
 * changed. An UPDATE across 6,289 rows is not reversible in the same sense, and
 * it would have to be re-run for every row an editor saves afterwards.
 *
 * ## The one source of truth
 *
 * `media-failover.ts` builds the same from/to pair for its client-side listener.
 * It imports it from here rather than deriving its own: two copies of this rule
 * that disagree would mean the server writes one host and the browser rescues to
 * another, and the symptom -- an image that stays broken -- would say nothing
 * about the cause.
 *
 * ## What this covers that the failover listener cannot
 *
 * The listener only hears `error` events from <img>, <video> and <audio>. A PDF
 * behind a plain <a href> is a navigation: the browser reports nothing back to
 * the page, so a dead link stays dead. The organisation profile PDF on the home
 * page is exactly that case. Rewriting at render time fixes it; rescuing at load
 * time never could.
 */

const PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/";

export interface MirrorRewrite {
  /** `//sukwifqplsyhbwmlfuti.supabase.co/storage/v1/object/public/media/` */
  from: string;
  /** `//media.tdinfo.org/` */
  to: string;
}

/**
 * The rewrite in force, or null when there is no mirror configured.
 *
 * Null is the off switch and the safe default: with no mirror host set, nothing
 * anywhere in this file or in `media-failover.ts` does anything at all, which is
 * what makes it safe to ship before a mirror exists and to turn off afterwards.
 */
export function mirrorRewrite(): MirrorRewrite | null {
  const mirrorHost = process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!mirrorHost) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  let sourceHost: string;
  try {
    sourceHost = new URL(supabaseUrl).host;
  } catch {
    return null;
  }
  if (!sourceHost || sourceHost === mirrorHost) return null;

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  /* The mirror keeps the bucket's own layout at its root, so the rewrite drops
     Supabase's API path and keeps the object key unchanged. Anything after the
     key -- a ?download= on the profile PDF, say -- rides along untouched. */
  return {
    from: `//${sourceHost}${PUBLIC_OBJECT_PREFIX}${bucket}/`,
    to: `//${mirrorHost}/`
  };
}

/**
 * Rewrites every public-object URL in a block of text.
 *
 * Text and not a parsed object on purpose: media URLs live in ordinary columns,
 * inside markdown bodies, and nested anywhere in a page's JSON. Walking a
 * structure would mean naming the fields, and the next field somebody adds
 * would be missed silently. A string replace over the response covers all three
 * and whatever comes next.
 *
 * Both `/` and the JSON-escaped `\/` are handled: PostgREST does not escape
 * forward slashes today, and a serialiser that starts to would otherwise slip
 * straight past this.
 *
 * Only `/object/public/` is matched. A signed URL (`/object/sign/`) carries a
 * token for a specific object and would be meaningless on the mirror, so it is
 * deliberately left alone -- that is the form the admin will use once the bucket
 * is private.
 */
export function rewriteMediaText(text: string, rule = mirrorRewrite()): string {
  if (!rule || !text) return text;
  const escapedFrom = rule.from.replace(/\//g, "\\/");
  const escapedTo = rule.to.replace(/\//g, "\\/");
  return text.split(rule.from).join(rule.to).split(escapedFrom).join(escapedTo);
}

/** The same rewrite for a single URL. Null and undefined pass through. */
export function rewriteMediaUrl<T extends string | null | undefined>(url: T, rule = mirrorRewrite()): T {
  if (!rule || typeof url !== "string") return url;
  return url.split(rule.from).join(rule.to) as T;
}
