/**
 * 站内链接有没有断的。
 *
 *     npm run links:check                 # 本地中文站 :4020
 *     npm run links:check -- --en         # 本地英文站 :4021
 *     LINKS_BASE=https://www.tuidang.org npm run links:check
 *
 * ## 为什么需要它
 *
 * 2026-10-22：英文站首页上「Case files」「First-hand accounts」「More testimony」
 * 这些按钮全是 404 —— 它们指向 /news/worldwide-investigation 这类中文站的栏目
 * slug，而英文站的栏目叫 terror-in-china、religious-persecution。链接是我播
 * 页面内容时照抄中文站的，当时那些栏目还在（我照搬着建了一份），后来确认
 * 英文站有自己的分类、把那 18 个空的删掉，链接就全断了。
 *
 * 这种断链没有任何现成检查看得见：页面 200、没有报错、文案也没问题，只有
 * 真的去点才知道。而且越早期越容易积累 —— 内容还少的时候，没人会去点。
 *
 * ## 怎么查
 *
 * 从几个入口出发，把站内页面抓一遍，收集所有 href，逐个请求，列出非 200 的。
 * 跳转跟到底 —— 「301 跳过去再 404」看起来是正常跳转，读者看到的却是 404。
 * 只查站内链接：外站的死活不归这个站管，而且逐个去打别人的服务器不礼貌。
 *
 * ## href 原样发出去，不要再编码一次
 *
 * 第一版写的是 fetch(BASE + encodeURI(href))。href 是从 HTML 里取出来的，
 * 本来就是百分号编码过的；encodeURI 会把里面的 % 再编成 %25，于是
 * /services/faq/%E5%A6%82... 变成 /services/faq/%25E5%25A6%2582...，
 * 服务器当然 404。
 *
 * 结果是这个脚本报了 6 条中文站的「断链」，而那 6 条原样请求全是 200 ——
 * 一个检查工具报出来的假故障，比不检查更坏：照着去改，改的是没坏的东西。
 */

const EN = process.argv.includes("--en");
const BASE = process.env.LINKS_BASE ?? (EN ? "http://localhost:4021" : "http://localhost:4020");
const PROBE = process.env.PROBE_BYPASS_SECRET?.trim();
const REMOTE = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
const headers: Record<string, string> = PROBE && REMOTE ? { "x-quitccp-probe": PROBE } : {};

/** 从这几页出发。它们之间互相链接，足以覆盖整个公开站的骨架。 */
const ENTRY = [
  "/", "/news", "/videos", "/resources", "/resources/downloads", "/resources/culture",
  "/services", "/services/faq", "/services/declare", "/services/cert", "/services/verify",
  "/about", "/about/team", "/about/history", "/about/network", "/about/accountability",
  "/involve", "/involve/volunteer", "/involve/stories", "/involve/endccp",
  "/legal/terms", "/legal/privacy"
];

/* 抓这些就够了：文章正文里的外链不归这个站管，而逐篇抓会把本地 dev 压垮。 */
const MAX_PAGES = 120;

function internal(href: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (/^https?:\/\//i.test(href)) {
    /* 指回自己的绝对地址也算站内 —— 这类最容易写错（比如英文站上写了
       https://www.tuidang.org/...，那是中文站）。 */
    try {
      const u = new URL(href);
      const b = new URL(BASE);
      return u.host === b.host ? u.pathname + u.search : null;
    } catch {
      return null;
    }
  }
  if (!href.startsWith("/")) return null;
  return href.split("#")[0];
}

async function main() {
  const seen = new Set<string>();
  const queue = [...ENTRY];
  /** 链接 → 它出现在哪几页上。报错时要说得出「在哪儿」。 */
  const foundOn = new Map<string, Set<string>>();

  while (queue.length > 0 && seen.size < MAX_PAGES) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await fetch(BASE + path, { headers, redirect: "manual" });
    if (res.status !== 200) continue;
    const html = await res.text();
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      const target = internal(m[1].replace(/&amp;/g, "&"));
      if (!target) continue;
      const bucket = foundOn.get(target) ?? new Set<string>();
      bucket.add(path);
      foundOn.set(target, bucket);
      /* 只继续抓骨架页，不抓文章 —— 文章有几百篇，而且它们的链接都是外站。 */
      if (!seen.has(target) && ENTRY.includes(target)) queue.push(target);
    }
  }

  console.log(`\n  从 ${seen.size} 个页面上收集到 ${foundOn.size} 个站内链接，逐个查……\n`);

  const broken: { href: string; status: number; from: string[]; via?: string }[] = [];
  let checked = 0;
  for (const [href, from] of foundOn) {
    let at = href;
    let res = await fetch(BASE + at, { headers, redirect: "manual" });
    checked += 1;

    /*
     * 跳转要跟到底，不能看见 3xx 就放过。
     *
     * 第一版的规则是「3xx 不算断，旧地址跳新地址是这个站的正常行为」。前半句
     * 对，后半句漏了一种情况：跳过去之后那一页不存在。
     *
     * 2026-10-22 英文站首页登记册那块就是这样 —— 推广位指向 /news/a/690040，
     * 那是中文文章的旧 ID，301 解析得好好的，落点是中文文章的 slug，而那篇在
     * 英文站上不存在。读者点下去看到的是 404，而这个脚本报的是「189 个链接
     * 全部可达」。
     *
     * 一个只验证「跳转存在」而不验证「跳到哪」的检查，比不检查更坏：它让人
     * 以为查过了。
     */
    const chain: string[] = [];
    while (res.status >= 300 && res.status < 400 && chain.length < 5) {
      const to = res.headers.get("location");
      if (!to) break;
      /* 跳到站外就到此为止 —— 别人的站不归这个站管。 */
      const next = internal(to);
      if (!next) break;
      chain.push(next);
      at = next;
      res = await fetch(BASE + at, { headers, redirect: "manual" });
    }

    if (res.status >= 400) {
      broken.push({ href, status: res.status, from: [...from], via: chain.join(" → ") || undefined });
    }
  }

  if (broken.length === 0) {
    console.log(`  ✓ ${checked} 个站内链接全部可达\n`);
    return;
  }
  console.log(`  ✗ ${broken.length} 个断链（共查了 ${checked} 个）：\n`);
  for (const b of broken.sort((a, z) => z.from.length - a.from.length)) {
    console.log(`  ${b.status}  ${b.href}${b.via ? `  （跳转到 ${b.via}）` : ""}`);
    console.log(`        出现在：${b.from.slice(0, 4).join("、")}${b.from.length > 4 ? ` 等 ${b.from.length} 页` : ""}`);
  }
  console.log("");
  process.exit(1);
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
