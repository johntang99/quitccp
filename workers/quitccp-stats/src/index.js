/**
 * Counts page views for the public site, and nothing else.
 *
 * The reader's browser sends one small beacon per page it shows (see
 * apps/web/src/components/public/PageViewBeacon.tsx). This turns it into one
 * Workers Analytics Engine data point. The site's database never sees it: the
 * 2026-10-13 flood was hundreds of millions of hits on one article, and a
 * counter that wrote to Postgres on every read would hand the next one a way
 * straight back in. Here a flood costs Cloudflare a few data points and is
 * capped per source before it can even skew the rankings.
 *
 * ## What is kept, and what deliberately is not
 *
 * Readers of this site are overseas Chinese reading about quitting the CCP. A
 * list of who read what must not come into existence as a side effect of a
 * traffic chart. So:
 *
 * - no IP, no user agent, no cookie, no identifier that survives the day;
 * - location is what Cloudflare already resolved -- country, region, city --
 *   recorded as a place, never joined to a person;
 * - "visitors" are counted with a hash of (salt, IP, UA, site), where the salt
 *   is random, changes every UTC day and is deleted after two. Within a day the
 *   same reader counts once; the next day nothing links them, and once the
 *   salt is gone nobody -- including us -- can test a hash against an IP.
 *
 * Every request gets 204 whatever happens to it, so a probe learns nothing
 * about which hits were counted and which were dropped.
 */

const NO_CONTENT = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * Crawlers, monitors and headless browsers. Most never run the page's script
 * and so never reach here; this is for the ones that do. Messaging apps are
 * deliberately not on it: their link previews do not run scripts, while their
 * in-app browsers are real readers and some say "Telegram" in the UA.
 */
const BOT_UA = /bot|crawl|spider|slurp|monitor|headless|lighthouse|python|curl|wget|httpclient|java\/|go-http|node-fetch|axios/i;

function deviceOf(ua) {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|phone/i.test(ua)) return "mobile";
  return "desktop";
}

/** Only the host. A full referrer can carry a search query or a private URL. */
function referrerHost(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    return new URL(value).hostname.toLowerCase().slice(0, 120);
  } catch {
    return "";
  }
}

function clean(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Today's salt, created on first use. KV is eventually consistent, so in the
 * first minute of a UTC day two locations can each mint one; the later write
 * wins and the early readers of that minute are counted as two visitors
 * instead of one. That is the whole cost, and it is a small overcount once a
 * day -- cheaper than any coordination.
 */
async function dailySalt(env, day) {
  const key = `salt:${day}`;
  let salt = await env.SALTS.get(key);
  if (!salt) {
    salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    await env.SALTS.put(key, salt, { expirationTtl: 2 * 86400 });
  }
  return salt;
}

async function visitorHash(salt, ip, ua, site) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}|${ua}|${site}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/hit") return new Response("Not Found", { status: 404 });

    let sites = {};
    try {
      sites = JSON.parse(env.SITES || "{}");
    } catch {}
    /* The site comes from the Origin header, not the body: a page on the
       English site cannot file its views under the Chinese one by saying so. */
    const site = sites[request.headers.get("origin") ?? ""];
    if (!site) return NO_CONTENT();

    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || BOT_UA.test(ua)) return NO_CONTENT();

    let body;
    try {
      /* sendBeacon posts text/plain so that the browser sends it without a
         CORS preflight; it is JSON all the same. */
      body = JSON.parse(await request.text());
    } catch {
      return NO_CONTENT();
    }
    const path = clean(body?.p, 400);
    if (!path.startsWith("/")) return NO_CONTENT();

    const ip = request.headers.get("cf-connecting-ip") ?? "";
    const [perPage, perSource] = await Promise.all([
      env.PER_PAGE.limit({ key: `${ip}|${path}` }),
      env.PER_SOURCE.limit({ key: ip })
    ]);
    if (!perPage.success || !perSource.success) return NO_CONTENT();

    const day = new Date().toISOString().slice(0, 10);
    const visitor = await visitorHash(await dailySalt(env, day), ip, ua, site);
    const cf = request.cf ?? {};

    env.HITS.writeDataPoint({
      // The sampling key. Per page, so a quiet article is not sampled away
      // because a busy one shares its key.
      indexes: [`${site}:${path}`.slice(0, 96)],
      blobs: [
        site,                                   // 1  site
        path,                                   // 2  path, as the browser has it
        referrerHost(body?.r),                  // 3  referrer host
        body?.n === 1 ? "nav" : "",             // 4  "nav": moved within the site without a reload
        clean(body?.u, 60).toLowerCase(),       // 5  utm_source
        clean(cf.country, 8),                   // 6  country, ISO 3166
        clean(cf.region, 80),                   // 7  region / state
        clean(cf.city, 80),                     // 8  city
        deviceOf(ua),                           // 9  mobile / tablet / desktop
        clean(body?.l, 16),                     // 10 browser language, e.g. zh-TW
        visitor,                                // 11 daily visitor hash
        body?.f === 1 ? "1" : "0"               // 12 first visit on this browser
      ],
      doubles: [1]
    });

    return NO_CONTENT();
  }
};
