"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

/**
 * 一条看得见、点一下就能复制的短地址。
 *
 * ## 为什么要把地址本身显示出来
 *
 * 按钮只服务「想到要点它」的那部分人；大多数人分享的办法是去地址栏框选。
 * 把短地址摆在眼前，读者才会意识到有这个东西可用 —— 这一行本身就是说明，
 * 不需要另写一句「本文短链接：」。
 *
 * 对这个站还有一层：公开地址是中文标题，编码后一篇 168 个字符、最长的视频
 * 611 个。那种链接贴进微信是一长条百分号，而读者正是被反复教育要警惕异常
 * 链接的那群人 —— 一个劝人退党的网站，分享出去的地址看起来像钓鱼链接，
 * 这是信任问题，不是美观问题。
 *
 * ## 显示和复制用的不是同一个来源
 *
 * 显示用 `NEXT_PUBLIC_SITE_URL`：这一行是服务端渲染的，读 `window` 会让
 * 服务端和客户端渲出两个不同的字符串，也就是一次水合不一致。
 *
 * 复制用 `location.origin`：点击一定发生在浏览器里，而且在预览部署上复制出
 * 一条指向生产的链接，是会让人困惑的那种错。
 */
export function ShortLink({
  code,
  kind,
  className = "pill"
}: {
  code: string;
  /** 文章是 a，视频是 v。 */
  kind: "a" | "v";
  /** 外面那一行用什么样式 —— 文章是 pill，视频元信息带是朴素文字。 */
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const path = `/${kind}/${code}`;
  const shown = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${path}`;

  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* 不安全来源和一部分浏览器会拒绝剪贴板接口。退回老办法，而不是什么都
         不做 —— 按了没反应，读者只会以为网站坏了。 */
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
    <button
      type="button"
      className={className}
      onClick={copy}
      title={t("share.shortTitle")}
      style={{ fontFamily: "ui-monospace, Menlo, monospace", cursor: "pointer" }}
    >
      {copied ? t("share.copied") : shown}
    </button>
  );
}
