/**
 * Rescues media back to Supabase when the mirror stops answering.
 *
 * Reversed on 2026-10-15: see the note on direction inside the function. It was
 * written when Supabase was the primary and the mirror the rescue; the server
 * now serves mirror URLs, so the rescue runs the other way.
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

import { mirrorRewrite } from "@/lib/media-mirror";

export function mediaFailoverScript(): string | null {
  const rule = mirrorRewrite();
  if (!rule) return null;

  /*
   * Which way round this runs changed on 2026-10-15. The server now rewrites
   * stored URLs to the mirror before the page is sent, so what reaches the
   * browser already names the mirror and this listener would never match it.
   * It is therefore reversed here: it rescues a failed mirror request back to
   * Supabase, which is the direction that is now useful.
   *
   * Both legs stay standing that way. Supabase remains the fallback for as
   * long as the bucket is public; the day it is made private, this listener
   * stops being able to help and should be removed rather than left to swap in
   * a URL that cannot answer.
   */
  const from = rule.to;
  const to = rule.from;

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
