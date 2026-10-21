import { NextResponse } from "next/server";
import { SITE_LOCALE, type Locale } from "@/lib/site-config";

/**
 * 这个定时任务该不该在这个站上跑。
 *
 * 定时任务定义在 `apps/web/vercel.json` 里，而那个文件在仓库里 —— 四个 Vercel
 * 项目读的是同一份，所以**每个站都会收到全部七个 cron 的触发**。
 *
 * 对大多数任务这没问题，各站同步各站的东西正是我们要的。但有三个是去外部站点
 * 抓中文数据的：
 *
 *   santui        抓 santui.tuidang.org 的登记册数字
 *   endccp        抓 endccp.com/zh-hans/
 *   zhuichaguoji  抓追查国际的中文 RSS
 *
 * 四个站各跑一遍，对这些外部源的请求量就是四倍，而且抓回来的是同一份中文数据，
 * 写进同一张表。被对方限速甚至封掉，换来的是零收益。
 *
 * 登记册那个数字是全球总数，四个站都要显示 —— 但只需要一个站去抓，其余从数据库读。
 *
 * ## 为什么返回 200 而不是错误
 *
 * Vercel 的 cron 面板按状态码判断成败。跳过是正常状态，不是失败；返回非 200
 * 会让德文站的面板上永远挂着三条红色的定时任务，而那正是「报警变噪音」的开头。
 */
/**
 * 抓登记册的任务在哪些站跑。
 *
 * 导出是为了让后台那块「登记册同步」面板跟着它走 —— 面板属于去抓的那个站。
 * 两处各写一个 'zh'，哪天任务挪了地方，面板会悄悄对不上。
 */
export const SANTUI_LOCALES = ["zh"] as const satisfies readonly Locale[];

export function skipUnlessLocale(allowed: readonly Locale[]): NextResponse | null {
  if (allowed.includes(SITE_LOCALE)) return null;
  return NextResponse.json({
    ok: true,
    skipped: true,
    locale: SITE_LOCALE,
    reason: `这个任务只在 ${allowed.join("、")} 站上跑`
  });
}
