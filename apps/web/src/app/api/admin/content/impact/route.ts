import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * 删一篇内容之前，告诉编辑删掉会牵连什么。
 *
 * 为什么有这个接口：2026-10-16 编辑把「铁证如山」32 集改成视频重新发布，再删掉
 * 重复的文章版 —— 判断是对的，但有 32 条旧 WP 链接指着那些文章，删完全变成 308
 * 跳 404。后台从头到尾没提过这件事，断了四天才被发现。编辑当时是唯一知道「内容
 * 搬去了视频区」的人，缺的只是一句提示。
 *
 * 只报告，不自动改。链接指向一篇即将不存在的文章，没有哪个自动改法是对的：改成
 * 栏目首页是降级，删掉链接是丢信息，而「这一篇对应视频区第 26 集」这种关系只有
 * 人知道。
 *
 * 四张表的正文里找字符串，在生产上量过约 600 毫秒 —— 对一个点「删除」才会打开
 * 的对话框可以接受，但不能放进列表页那种每次都加载的地方。
 */
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tuidang.org").replace(/\/$/, "");

interface Inbound {
  kind: string;
  id: string;
  label: string;
  slug: string;
}

export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") === "video" ? "video" : "article";
  const id = (params.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const table = kind === "video" ? "cms_videos" : "cms_articles";
  const section = kind === "video" ? "/videos/" : "/news/";
  const shortPrefix = kind === "video" ? "/v/" : "/a/";

  try {
    const supabase = createSupabaseAdminClient();
    /* locale-ok: 按 id 查（uuid 全局唯一），表名由 kind 决定。 */
    const { data: row, error: rowError } = await supabase
      .from(table)
      .select("slug, slug_legacy, short_code")
      .eq("id", id)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    /*
     * 同一篇的链接在站内有好几种写法，少查一种就漏报一批死链。文章正文里相对
     * 地址其实很少 —— 量过：带域名的绝对地址有 329 篇，/news/ 开头的 28 篇里
     * 大半还是旧 WP 的 .mp4 媒体路径。所以绝对地址和短码都必须查。
     */
    const paths = [`${section}${row.slug}`];
    if (row.slug_legacy && row.slug_legacy !== row.slug) paths.push(`${section}${row.slug_legacy}`);

    const needles = [...paths, ...paths.map((p) => `${SITE}${p}`)];
    if (row.short_code) {
      needles.push(`${shortPrefix}${row.short_code}`, `${SITE}${shortPrefix}${row.short_code}`);
    }

    const [{ data: redirects, error: redirectError }, { data: inbound, error: inboundError }] =
      await Promise.all([
        supabase.rpc("redirects_to_paths", { p_paths: paths }),
        supabase.rpc("content_inbound_links", { p_needles: needles, p_exclude_id: id })
      ]);
    if (redirectError) throw new Error(redirectError.message);
    if (inboundError) throw new Error(inboundError.message);

    const redirectRows = (redirects ?? []) as { legacy_url: string }[];
    const inboundRows = (inbound ?? []) as Inbound[];

    /*
     * 「它自己改名前的地址」和「外面的旧链接」要分开数。
     *
     * 拼音迁移给每一篇都留了一条 `/news/<中文 slug>` → `/news/<拼音 slug>`，所以
     * 「有旧链接指向这一篇」对一万六千篇都成立。不分开的话这块面板会在每次删除时
     * 都亮橙色，于是没人再看它 —— 和一个永远报警的监控一样没用。
     *
     * 分开之后数字才有意义：自己的旧地址删掉就删掉了，没人会从外面点进来；而一条
     * 旧站链接可能还在别人的网页里、在搜索结果里、在谁的收藏夹里。
     */
    const ownOldPath = row.slug_legacy ? `${section}${row.slug_legacy}` : null;
    const external = redirectRows.filter((r) => r.legacy_url !== ownOldPath);

    return NextResponse.json({
      ok: true,
      redirects: redirectRows.length,
      external: external.length,
      hasOwnOld: Boolean(ownOldPath) && redirectRows.length > external.length,
      /* 几条就够看出是哪一类旧链接；一篇有上百条时全部列出来帮不上忙。 */
      redirectSample: external.slice(0, 5).map((r) => r.legacy_url),
      inbound: inboundRows.slice(0, 20),
      inboundTotal: inboundRows.length
    });
  } catch (error) {
    /* 查不出来不能把删除按钮卡死 —— 对话框会显示「查不到」并照常允许删除。 */
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
