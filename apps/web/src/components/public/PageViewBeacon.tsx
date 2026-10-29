"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { STATS_ENDPOINT } from "@/lib/site-stats";

/**
 * 每显示一个页面，向统计 Worker 发一次 beacon。
 *
 * 只发：路径、来源网站、utm_source、浏览器语言、是否首次来访。不带 cookie，
 * 不带任何编号 —— 访客去重在 Worker 那边用每日更换的盐做，见
 * workers/quitccp-stats/src/index.js。
 *
 * 跟着 pathname 走而不是只在加载时发一次：站内点链接是客户端跳转，页面不重新
 * 加载，只在加载时发的话，读者看的第二篇、第三篇文章都不会被算到。
 *
 * 来源只在进站那一次用 document.referrer；之后的站内跳转标成 `n: 1`，否则
 * 浏览器给的 referrer 一直是最初那个 Google，一个读者看五篇就成了「Google
 * 带来五次访问」。
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  const seen = useRef(false);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    if (!/(^|\.)tuidang\.org$/.test(window.location.hostname)) return;

    const first = !seen.current;
    seen.current = true;

    /* 「来过」只是浏览器里的一个是/否，不发送、不生成任何编号。 */
    let firstVisit = 0;
    try {
      if (!window.localStorage.getItem("quitccp.visited")) {
        firstVisit = 1;
        window.localStorage.setItem("quitccp.visited", "1");
      }
    } catch {}

    const payload = JSON.stringify({
      p: pathname,
      r: first ? document.referrer : "",
      n: first ? 0 : 1,
      u: first ? new URLSearchParams(window.location.search).get("utm_source") ?? "" : "",
      l: navigator.language ?? "",
      f: firstVisit
    });
    try {
      /* text/plain 免去 CORS 预检；sendBeacon 在读者马上离开页面时也能送出。 */
      if (!navigator.sendBeacon?.(STATS_ENDPOINT, new Blob([payload], { type: "text/plain" }))) {
        void fetch(STATS_ENDPOINT, { method: "POST", body: payload, keepalive: true, mode: "no-cors" });
      }
    } catch {}
  }, [pathname]);

  return null;
}
