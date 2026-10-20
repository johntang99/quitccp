"use client";

import { useState } from "react";
import { ShortLink } from "@/components/public/ShortLink";

/**
 * The row of actions under an article.
 *
 * These were four `href="#"` links: clicking any of them jumped to the top of
 * the page and did nothing else. Each one now does what its label says, and the
 * ones we cannot honour are not shown rather than shown broken -- 下载 PDF,
 * for which nothing in the codebase generates a PDF, and 转载说明, which only
 * scrolled to the 转载条款 panel already visible in the sidebar beside it.
 *
 * 短地址那一颗是 `ShortLink`，和视频页用的是同一个 —— 复制的退路写一份就够，
 * 两份迟早会有一份没修到。
 */
export function ArticleTools({ shortCode }: { shortCode?: string }) {
  const [copied, setCopied] = useState(false);

  /* 没有短码时才会走到这里：复制当前地址，也就是那条长的。回填之后只剩
     「新闻列表条目」虚拟出来的文章还没有码。 */
  const copyCurrent = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } catch {
        window.prompt("复制这个地址：", url);
      }
      document.body.removeChild(field);
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {shortCode ? (
        <ShortLink code={shortCode} kind="a" />
      ) : (
        <button type="button" className="pill" onClick={copyCurrent}>
          {copied ? "已复制 ✓" : "复制链接"}
        </button>
      )}
      <button type="button" className="pill" onClick={() => window.print()}>
        打印
      </button>
    </>
  );
}
