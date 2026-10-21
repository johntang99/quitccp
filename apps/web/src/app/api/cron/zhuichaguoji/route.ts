import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { revalidateNews } from "@/lib/admin/revalidate-news";
import {
  fetchZcgjItems,
  ZCGJ_CATEGORY_SLUG,
  ZCGJ_SOURCE_TITLE,
  zcgjSlug
} from "@/lib/zhuichaguoji";
import { skipUnlessLocale } from "@/lib/cron-locale";

const LOCALE = "zh";

/** 三十篇，每篇一次 upsert 加一次映射。给足余量，正常一分钟以内跑完。 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * 追查国际同步。
 *
 * 源站的 RSS 只给最新三十条，所以这就是全部范围 —— 不翻页、不补历史，
 * 那是 2026-10-17 明确定下的。新的进来、旧的自然滚出三十条之外，但我们
 * 这边不会删：导过的文章留在站上，它只是不再被这个任务更新。
 *
 * ## 为什么直接发布
 *
 * 第一批三十篇是编辑过目之后放行的，此后新来的同源同栏目，再卡一道人工
 * 就等于让同步失去意义 —— 没人盯着草稿，稿子就永远躺在那里。想改回草稿
 * 只要把下面的 status 换成 draft。
 *
 * ## 认 source_url 不认 slug
 *
 * slug 从标题生成，而标题是对方随时可以改的；node id 不会变。所以先按
 * source_url 查出已有的行再决定插还是更，而不是靠 slug 撞。
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

  let items;
  try {
    items = await fetchZcgjItems();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fetch failed";
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }
  if (items.length === 0) {
    /* 源站回了二百，但一条都没解析出来 —— 多半是页面改版。报错而不是安静
       地返回成功，否则我们只会看到数字停住，不知道为什么。 */
    return NextResponse.json({ ok: false, reason: "feed parsed to zero items" }, { status: 502 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: categoryRow, error: categoryError } = await supabase
    .from("cms_article_categories")
    .select("id")
    .eq("locale", LOCALE)
    .eq("slug", ZCGJ_CATEGORY_SLUG)
    .maybeSingle();
  if (categoryError || !categoryRow) {
    return NextResponse.json({ ok: false, reason: `category ${ZCGJ_CATEGORY_SLUG} missing` }, { status: 500 });
  }

  const { data: existing } = await supabase
    .from("cms_articles")
    .select("id, slug, source_url")
    .eq("locale", LOCALE)
    .in("source_url", items.map((item) => item.link));
  const bySource = new Map((existing ?? []).map((row) => [String(row.source_url), row]));

  const payload = items.map((item) => {
    const prior = bySource.get(item.link);
    return {
      /* 已经导过的沿用原 slug：地址一旦对外，改它就是制造死链。 */
      slug: prior ? String(prior.slug) : zcgjSlug(item.title, item.link),
      locale: LOCALE,
      title: item.title,
      subtitle: item.subtitle,
      summary: item.summary,
      body_markdown: item.bodyMarkdown,
      body_plain: item.bodyPlain,
      section: "news",
      status: "published",
      editorial_status: "published",
      source_title: ZCGJ_SOURCE_TITLE,
      source_url: item.link,
      published_at: item.publishedAt
    };
  });

  const { data: saved, error: saveError } = await supabase
    .from("cms_articles")
    .upsert(payload, { onConflict: "slug,locale" })
    .select("id, slug");
  if (saveError) {
    return NextResponse.json({ ok: false, reason: saveError.message }, { status: 500 });
  }

  const { error: mapError } = await supabase
    .from("cms_article_category_map")
    .upsert(
      (saved ?? []).map((row) => ({
        article_id: String(row.id),
        category_id: String(categoryRow.id),
        position: 0
      })),
      { onConflict: "article_id,category_id" }
    );
  if (mapError) {
    return NextResponse.json({ ok: false, reason: mapError.message }, { status: 500 });
  }

  /* 同一套清理路径，和编辑按保存走的是一个函数 —— 首页、/news、全部列表页
     加每篇文章自己的地址。 */
  await revalidateNews((saved ?? []).map((row) => String(row.slug)));

  return NextResponse.json({
    ok: true,
    fetched: items.length,
    added: items.length - bySource.size,
    updated: bySource.size
  });
}
