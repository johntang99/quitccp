import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { ENDCCP_FEED_PATH, parseEndccpCount, type EndccpSnapshot } from "@/lib/endccp";
import { skipUnlessLocale } from "@/lib/cron-locale";

const LOCALE = "zh";
const SOURCE = "https://endccp.com/zh-hans/";

/** One page, one regex. Nothing here needs the 300s the santui scrape needs. */
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Keeps the End CCP signature count current.
 *
 * Unlike santui, endccp.com answers an ordinary fetch -- no Cloudflare
 * interstitial, no browser needed -- so this is a plain GET and a parse. See
 * `lib/endccp.ts` for why the figure has to be read out of the page at all.
 *
 * A failed run writes nothing. The last good snapshot stays, and under that the
 * figure an editor typed into the CMS: two fallbacks deep, so a bad day at
 * endccp.com cannot blank the number on our own pages.
 *
 * Authorised by Vercel's cron header or by an admin session, the same as the
 * santui job, so it can be triggered by hand from the dashboard.
 */
async function authorise(request: Request): Promise<string | null> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return null;
  const user = await getAdminSessionUser();
  if (user) return null;
  return secret ? "Unauthorized" : "CRON_SECRET is not configured";
}

export async function GET(request: Request) {
  /* 抓的是中文数据源。四个站都跑的话，对方收到的是四倍请求，
     而写进数据库的是同一份数据。 */
  const skip = skipUnlessLocale(["zh"]);
  if (skip) return skip;

  const denied = await authorise(request);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  let html: string;
  try {
    const response = await fetch(SOURCE, {
      cache: "no-store",
      /* A browser UA because the page is a WordPress install behind the usual
         plugins; a bare fetch agent is the kind of thing they refuse. */
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "accept-language": "zh-CN,zh;q=0.9"
      },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, reason: `HTTP ${response.status}` }, { status: 502 });
    }
    html = await response.text();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fetch failed";
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }

  const count = parseEndccpCount(html);
  if (count === null) {
    /* The page loaded but the counter was not where it has always been. Worth a
       502 rather than a quiet 200: this is how we find out the source changed
       shape, instead of watching the number silently freeze. */
    return NextResponse.json({ ok: false, reason: "counter not found on page" }, { status: 502 });
  }

  const snapshot: EndccpSnapshot = {
    count,
    fetchedAt: new Date().toISOString(),
    source: SOURCE
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cms_content_entries")
    .upsert({ path: ENDCCP_FEED_PATH, locale: LOCALE, data: snapshot }, { onConflict: "path,locale" });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }

  /* The three pages that print this number. */
  revalidatePath("/");
  revalidatePath("/involve");
  revalidatePath("/involve/endccp");

  return NextResponse.json({ ok: true, count, fetchedAt: snapshot.fetchedAt });
}
