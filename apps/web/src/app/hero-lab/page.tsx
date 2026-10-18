import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeroLab } from "@/components/public/HeroLab";

/**
 * 首屏比例试验台。
 *
 * 用来回答一个只能用眼睛和尺子回答的问题：首屏视频该做成什么宽高比，才能
 * 「上下不被裁」且「不超过一屏高」。几何推导给得出候选答案，但推导里的
 * 「可用视口高度」是估的 —— 浏览器界面占多少，取决于书签栏开没开、系统
 * 缩放多少、是不是全屏。所以要有个地方把真实数字量出来。
 *
 * ## 为什么不另写一套样式
 *
 * 页面刻意用和首页一模一样的类名（`hero hero--full-bleed` + `.hero-media`），
 * 让 globals.css 和 base.css 里那十几条规则原样生效。另写一套「差不多的」
 * 样式来测，测的就是那套样式，不是线上那套。
 *
 * ## 只在开发环境开放
 *
 * 它没有任何敏感内容，但也没有任何对读者的价值，而且会跟首页抢搜索引擎的
 * 注意力。要在手机上看，用同一个 wifi 访问开发机的局域网地址。
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function HeroLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HeroLab />;
}
