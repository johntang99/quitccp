/**
 * 看一眼追查国际同步会导进来什么，不写库。
 *
 *   npx tsx --env-file=.env.local scripts/import-zhuichaguoji.ts
 *
 * 真正的同步在 /api/cron/zhuichaguoji，由 Vercel Cron 每天跑，也可以带
 * CRON_SECRET 手动触发。这个脚本只负责「写入之前先看看」，和那条路由
 * 共用 lib/zhuichaguoji.ts 里的同一套解析 —— 两份解析迟早会各自漂移，
 * 然后你在这里看到的和站上登出来的就不是一回事了。
 */
import { excerpt, fetchZcgjItems } from "../apps/web/src/lib/zhuichaguoji";

async function main() {
  const items = await fetchZcgjItems();
  console.log(`源里解析出 ${items.length} 条\n`);
  for (const item of items) {
    const cut = Math.round((1 - item.bodyMarkdown.length / item.fullLength) * 100);
    console.log(`  ${item.publishedAt.slice(0, 10)}  ${item.title}`);
    console.log(`      全文 ${item.fullLength} 字 → 节选 ${item.bodyMarkdown.length} 字（截掉 ${cut}%）`);
  }
  const sample = items[0];
  if (sample) {
    console.log("\n" + "=".repeat(70));
    console.log(`第一篇节选全貌：${sample.title}`);
    console.log("=".repeat(70));
    console.log(sample.bodyMarkdown);
  }
}

main().catch((error) => {
  console.error("失败：", error instanceof Error ? error.message : error);
  process.exit(1);
});
