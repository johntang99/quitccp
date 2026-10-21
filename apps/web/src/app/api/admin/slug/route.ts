import { NextResponse } from "next/server";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { slugifyTitle } from "@/lib/admin/slugify";
import { SITE_LOCALE } from "@/lib/site-config";

/**
 * Romanises a title for 资料's slug field.
 *
 * It is a round trip for something the browser could in principle do, and that
 * is the point: the pinyin dictionary is about a megabyte and belongs on the
 * server. See `lib/admin/slugify.ts` for why a small character table is not an
 * acceptable substitute.
 *
 * Behind the admin session like every other route here. Not because a
 * romanisation is secret, but because an open endpoint that runs a dictionary
 * lookup per request is a free CPU faucet.
 */
export async function GET(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const title = params.get("title") ?? "";
  /* Titles are short. The cap is here so a pasted article body cannot turn one
     keystroke into a megabyte of dictionary work. */
  if (title.length > 300) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }

  /* 日期前缀用这一篇自己的发布时间，不是今天。编辑回填旧日期是常事，而前缀
     存在的意义就是区分同名文章 —— 全都盖上今天，它就什么也没区分。 */
  /* 不接受调用方传语言：网址用哪种转写办法由这个站决定，不由请求决定。
     让前端能指定的话，一个拼错的参数就能在中文站上造出一条日文式的地址。 */
  const slug = slugifyTitle(title, {
    withDate: params.get("date") === "1",
    date: params.get("at") || null,
    locale: SITE_LOCALE
  });
  return NextResponse.json({ slug, locale: SITE_LOCALE });
}
