import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SANTUI_USER_AGENT, type ScrapePage, scrapeSantui } from "@/lib/santui-scrape";

const FEED_PATH = "feeds/santui.json";
const LOCALE = "zh";

// The scrape waits out a Cloudflare interstitial on two page loads, so it needs
// far more than the 15s default. 300s is the Vercel Pro ceiling for a Node
// function; a healthy run finishes in well under a minute.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The santui sync, run by Vercel Cron against a hosted browser.
 *
 * santui.tuidang.org answers every plain HTTP request with a 403 Cloudflare
 * challenge, so this cannot be a fetch -- it needs a real browser. Rather than
 * packaging Chromium into the function (which runs into the bundle limit and
 * breaks whenever Chromium moves), the function stays tiny and drives a browser
 * someone else hosts, over a WebSocket.
 *
 * Authorised either by Vercel's own cron header or by an admin session, so the
 * dashboard can trigger a run by hand.
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
  const denied = await authorise(request);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const endpoint = process.env.BROWSER_WS_ENDPOINT;
  if (!endpoint) {
    return NextResponse.json({ error: "BROWSER_WS_ENDPOINT is not set" }, { status: 500 });
  }

  const log: string[] = [];
  const started = Date.now();
  // playwright-core carries no browser binaries, so this adds megabytes rather
  // than hundreds of them.
  const { chromium } = await import("playwright-core");

  // Browserbase and Browserless v2 both expose CDP; Browserless also has a
  // native Playwright endpoint. BROWSER_WS_MODE=playwright selects the latter.
  const mode = process.env.BROWSER_WS_MODE === "playwright" ? "playwright" : "cdp";
  const browser =
    mode === "playwright"
      ? await chromium.connect(endpoint, { timeout: 60_000 })
      : await chromium.connectOverCDP(endpoint, { timeout: 60_000 });

  try {
    const context = await browser.newContext({ locale: "zh-CN", userAgent: SANTUI_USER_AGENT });
    const page = (await context.newPage()) as unknown as ScrapePage;
    const snapshot = await scrapeSantui(page, (line) => log.push(line));

    const supabase = createSupabaseAdminClient();
    const { data: existing, error: readError } = await supabase
      .from("cms_content_entries")
      .select("id")
      .eq("path", FEED_PATH)
      .eq("locale", LOCALE)
      .maybeSingle();
    if (readError) throw readError;

    if (existing) {
      const { error } = await supabase
        .from("cms_content_entries")
        .update({ data: snapshot, updated_by: "cron:santui" })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("cms_content_entries")
        .insert({ path: FEED_PATH, locale: LOCALE, data: snapshot, updated_by: "cron:santui" });
      if (error) throw error;
    }

    // The figure is on the homepage, which is ISR; without this the fresh
    // number waits out the five-minute window.
    revalidatePath("/", "layout");

    return NextResponse.json({
      ok: true,
      total: snapshot.total,
      declarations: snapshot.declarations.length,
      withTitle: snapshot.declarations.filter((d) => d.title).length,
      fetchedAt: snapshot.fetchedAt,
      ms: Date.now() - started,
      log
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), ms: Date.now() - started, log },
      { status: 500 }
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
