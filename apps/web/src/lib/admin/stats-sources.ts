/**
 * 进站来源归类：搜索、社交、外站、直接、推广。
 *
 * 在汇总时归类，不在 Worker 里：Worker 只记来源网站的主机名，规则改了，重跑
 * 汇总就能把 3 个月内的历史数据按新规则重算。
 *
 * Signal、WhatsApp 等 App 打开链接时通常不带来源，所以算成「直接」。想单独看
 * 它们，就在发出去的链接上加 utm_source —— 带 utm 的一律算「推广」。
 */
export type SourceType = "search" | "social" | "referral" | "direct" | "campaign";

const SEARCH = [
  /(^|\.)google\.[a-z.]+$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)yahoo\.[a-z.]+$/,
  /(^|\.)yandex\.[a-z.]+$/,
  /(^|\.)naver\.com$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)search\.brave\.com$/,
  /(^|\.)startpage\.com$/,
  /(^|\.)qwant\.com$/,
  /(^|\.)sogou\.com$/,
  /(^|\.)so\.com$/,
  /(^|\.)seznam\.cz$/,
  // Google's Android app and Discover hand over android-app:// referrers.
  /^com\.google\.android\.googlequicksearchbox$/
];

const SOCIAL = [
  /(^|\.)facebook\.com$/,
  /(^|\.)fb\.com$/,
  /^t\.co$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)youtube\.com$/,
  /^youtu\.be$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)threads\.net$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)linkedin\.com$/,
  /(^|\.)pinterest\.[a-z.]+$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)weibo\.(com|cn)$/,
  /^t\.me$/,
  /(^|\.)telegram\.org$/,
  /(^|\.)ganjing\.com$/,
  /(^|\.)line\.me$/,
  /(^|\.)vk\.com$/,
  /(^|\.)discord\.com$/,
  /(^|\.)bsky\.app$/,
  /(^|\.)mastodon\.[a-z.]+$/
];

export function classifySource(host: string, utm: string): SourceType {
  if (utm) return "campaign";
  if (!host) return "direct";
  if (SEARCH.some((re) => re.test(host))) return "search";
  if (SOCIAL.some((re) => re.test(host))) return "social";
  return "referral";
}
