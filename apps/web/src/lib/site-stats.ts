import type { Locale } from "@/lib/site-config";

/**
 * 访问统计的公共常量。方案见 docs/implementation/site-analytics-plan.md。
 *
 * 读者浏览器把 beacon 发到 Cloudflare 上的 quitccp-stats Worker，记进 Workers
 * Analytics Engine（保留 3 个月）；中文站的 /api/cron/stats-rollup 每天汇总进
 * Supabase 的 cms_stats_* 表，后台 /admin/stats 读这些表。
 */
export const STATS_ENDPOINT = "https://stats.tdinfo.org/hit";

/** Analytics Engine 里的数据集名，和 workers/quitccp-stats/wrangler.toml 一致。 */
export const STATS_DATASET = "quitccp_hits";

/**
 * 哪些站在统计。2026-10-29 的决定：中、英文站分开统计，英文站暂不统计。
 *
 * 真正把关的是 Worker 的 SITES（按 Origin 认站）；这里决定页面要不要发 beacon、
 * 汇总任务在哪个站跑。要开英文站，两处都要加。
 */
export const STATS_LOCALES = ["zh"] as const satisfies readonly Locale[];
