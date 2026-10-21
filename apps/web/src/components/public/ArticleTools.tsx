"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

/**
 * 没有短码的文章结尾那两颗。
 *
 * 这里原来是四个 `href="#"` 的链接：点哪一个都只是跳回页首。后来剩下能真正
 * 做事的两颗 —— 下载 PDF（全站没有任何东西生成 PDF）和转载说明（只是滚到
 * 侧栏里已经看得见的那一块）宁可不显示，也不显示成坏的。
 *
 * 有短码的文章现在走 `<ShareBlock>`，那一块才是文末的正主。回填之后只剩
 * 「新闻列表条目」虚拟出来的文章还没有码，走到这里来。
 */
export function ArticleTools() {
  const [copied, setCopied] = useState(false);

  /** 复制当前地址，也就是那条长的 —— 没有短码时只能如此。 */
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
        window.prompt(t("share.copyPrompt"), url);
      }
      document.body.removeChild(field);
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" className="pill" onClick={copyCurrent}>
        {copied ? t("share.copied") : t("share.copyLink")}
      </button>
      <button type="button" className="pill" onClick={() => window.print()}>
        {t("share.print")}
      </button>
    </>
  );
}
