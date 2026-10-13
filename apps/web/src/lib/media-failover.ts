/**
 * Switches media over to the mirror when the primary host stops answering.
 *
 * Static-ifying the site protected the pages, not the media inside them. A
 * cached page comes from Vercel, but every image, audio file and video in it
 * still names sukwifqplsyhbwmlfuti.supabase.co, so the browser goes back to
 * Supabase for each one. On 2026-10-13 Storage answered 544 together with the
 * database, which means a reader on a perfectly cached page would have seen a
 * wall of broken images -- the pages survived and the content did not.
 *
 * Doing this per component was not an option: media is written as plain <img>
 * and <audio> in about twenty-five components, and also lives inside article
 * markdown bodies, where there is no component to change at all. One listener
 * covers all of it, including markup that does not exist yet.
 *
 * It works because a failed <img>/<audio>/<video> fires an `error` event which
 * does not bubble but does travel the capture phase, so a single capturing
 * listener at the window sees every media failure on the page. The listener is
 * inlined in <head> rather than mounted as a component, because images begin
 * loading as the HTML is parsed and can fail long before React hydrates -- a
 * useEffect would attach too late to hear it.
 *
 * Unset NEXT_PUBLIC_MEDIA_MIRROR_HOST and this emits nothing at all, so it is
 * safe to ship before a mirror exists.
 *
 * What it cannot cover: a PDF or zip behind a plain <a href> is a navigation,
 * not a subresource, and the browser reports nothing back to the page. Those
 * need their URLs rewritten at the source, not rescued at load time.
 */

const PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/";

export function mediaFailoverScript(): string | null {
  const mirrorHost = process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!mirrorHost) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  let sourceHost: string;
  try {
    sourceHost = new URL(supabaseUrl).host;
  } catch {
    return null;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  /* The mirror keeps the bucket's own layout at its root, so the rewrite is
     just: drop Supabase's API path, keep the object key. */
  const from = `//${sourceHost}${PUBLIC_OBJECT_PREFIX}${bucket}/`;
  const to = `//${mirrorHost}/`;

  /*
   * Deliberately not guarded by a per-element "tried once" flag. React may
   * re-render a component and write the original src back, and a flag would
   * then leave the image broken for good. Checking whether the URL already
   * names the mirror is self-limiting in the same way and survives a
   * re-render: a URL can only be rewritten in one direction, once.
   */
  return `(function(){var f=${JSON.stringify(from)},t=${JSON.stringify(to)};
addEventListener("error",function(e){var n=e.target;if(!n||!n.tagName)return;
var g=n.tagName;if(g!=="IMG"&&g!=="VIDEO"&&g!=="AUDIO"&&g!=="SOURCE")return;
var s=n.getAttribute("src")||"";if(s.indexOf(f)<0)return;
n.setAttribute("src",s.replace(f,t));
var m=g==="SOURCE"?n.parentNode:n;if(m&&m.load)try{m.load()}catch(x){}},true)})();`;
}
