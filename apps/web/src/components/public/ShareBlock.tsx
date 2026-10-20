"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { QrCode } from "@/lib/qr";

/**
 * 一篇文章、一支影片读完之后的那一块：短地址、复制、转发、二维码、打印。
 *
 * ## 为什么不是一排按钮
 *
 * 之前这里是「复制链接」和「打印」两颗。按钮只服务「想到要点它」的人，而大多数
 * 人分享的办法是去地址栏框选 —— 那条地址编码后一篇 168 个字符，贴进微信是一长条
 * 百分号。把短地址摆在眼前，这一行本身就是说明。
 *
 * ## 五个转发口是怎么挑的
 *
 * X 和 Facebook 是本站自己的渠道；Telegram、WhatsApp 是海外华人真正点对点转发用
 * 的东西，没有它们这一排就只剩「发公开帖」这一种分享。邮件留给年纪大的读者。
 * 微博没有 —— 那是墙内。LINE 没有 —— 日文站是另一个站。
 *
 * 全部是普通 `href`，不挂 Facebook / X 的 SDK：那两个脚本会在每一篇文章页上，
 * 对每一个读者建立一次第三方连接。这个站不该这么干。
 *
 * ## 微信怎么办
 *
 * 微信没有网页分享接口，唯一的路是二维码。所以桌面上二维码是常驻的一列，不是
 * 藏在按钮后面；手机上反过来 —— 扫不了自己的屏幕，常驻纯占地方，收进按钮里，
 * 点开给对方扫。
 *
 * 手机上最该按的那一颗是「分享」，它调出系统自带的分享菜单，微信就在里面。
 * 桌面浏览器基本没有这个接口，所以那一颗只在手机上、而且确实支持时才出现。
 */

type Kind = "a" | "v";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

/** 显示用：掉协议头，读者看到的是 www.tuidang.org/a/24ZMePC。 */
function shownUrl(path: string): string {
  return `${SITE.replace(/^https?:\/\//, "")}${path}`;
}

export function ShareBlock({
  code,
  kind,
  title,
  qr
}: {
  code: string;
  kind: Kind;
  /** 转发到社交网站和邮件时带的标题。 */
  title: string;
  /** 服务端算好的二维码；没有短码时为 null。 */
  qr: QrCode | null;
}) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  /* 服务端渲染时一定是 false，客户端首帧也是 false —— 挂载后才翻，
     这样不会有水合不一致。 */
  const [canNative, setCanNative] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
    } catch {
      setCanNative(false);
    }
  }, []);

  if (!code) return null;

  const path = `/${kind}/${code}`;
  const shown = shownUrl(path);
  /* 转发链接在服务端就要定下来，所以用站点地址而不是 location —— 预览部署上
     转发出去的也该是生产地址，没人想分享一条预览链接。 */
  const absolute = `${SITE}${path}`;
  const enc = encodeURIComponent(absolute);
  const encTitle = encodeURIComponent(title);

  const copy = async () => {
    /* 复制用 location.origin：点击一定发生在浏览器里，本地调试时复制出一条
       指向生产的链接是会让人困惑的那种错。 */
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
        window.prompt("复制这个地址：", url);
      }
      document.body.removeChild(field);
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({ title, url: `${window.location.origin}${path}` });
    } catch {
      /* 用户自己取消了菜单也走这里，所以这里什么都不做才是对的。 */
    }
  };

  return (
    <section className="sharebox" data-native={canNative ? "1" : "0"} aria-label="转载与分享">
      <div className="sharebox-in">
        <div className="sharebox-main">
          <p className="sharebox-h">转载与分享</p>

          {/* 手机上最该按的那一颗，所以它排在地址前面。桌面浏览器基本没有这个
              接口，`data-native` 翻过来之前它一直是隐藏的。 */}
          <button type="button" className="sharenative" onClick={share}>
            <IconShare />
            <span>分享</span>
          </button>

          <div className="sharefield">
            <span className="sharefield-url">{shown}</span>
            <button type="button" className="sharefield-copy" onClick={copy}>
              <IconCopy />
              <span>{copied ? "已复制 ✓" : "复制"}</span>
            </button>
          </div>

          <div className="shareacts">
            <div className="shareicons">
              <a
                className="sharepip sharepip--x"
                href={`https://x.com/intent/post?url=${enc}&text=${encTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="分享到 X"
              >
                <IconX />
              </a>
              <a
                className="sharepip sharepip--fb"
                href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="分享到 Facebook"
              >
                <IconFacebook />
              </a>
              <a
                className="sharepip sharepip--tg"
                href={`https://t.me/share/url?url=${enc}&text=${encTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="分享到 Telegram"
              >
                <IconTelegram />
              </a>
              <a
                className="sharepip sharepip--wa"
                href={`https://api.whatsapp.com/send?text=${encTitle}%20${enc}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="分享到 WhatsApp"
              >
                <IconWhatsApp />
              </a>
              <a className="sharepip" href={`mailto:?subject=${encTitle}&body=${enc}`} aria-label="用邮件分享">
                <IconMail />
              </a>
            </div>

            <span className="sharesep" aria-hidden="true" />

            {qr ? (
              <button type="button" className="sharebtn shareqr-btn" onClick={() => setQrOpen(true)}>
                <IconQr />
                <span>二维码</span>
              </button>
            ) : null}

            <button type="button" className="sharebtn" onClick={() => window.print()}>
              <IconPrint />
              <span>打印</span>
            </button>
          </div>
        </div>

        {qr ? (
          <div className="shareqr">
            <button type="button" className="shareqr-tile" onClick={() => setQrOpen(true)} aria-label="放大二维码">
              <QrSvg qr={qr} size={78} />
            </button>
            <span>扫码分享</span>
          </div>
        ) : null}
      </div>

      {/* 只在打印时出现。屏幕上转载条款在侧栏里，而侧栏不上纸 —— 一张印出来
          准备再传出去的纸，恰恰最需要这一句和来源。 */}
      <p className="share-printnote">
        {kind === "v" ? "本片" : "本文"}可自由转载、翻译与再制作，无需事先取得授权，注明来源即可。
        来源：全球退党服务中心 {shown}
      </p>

      {/* 弹层挂到 body 上：这一块外面任何一层有 transform 都会让 position:fixed
          改认那一层当参照，弹层就会卡在版心里。 */}
      {mounted && qrOpen && qr
        ? createPortal(<QrModal qr={qr} shown={shown} code={code} kind={kind} onClose={() => setQrOpen(false)} />, document.body)
        : null}
    </section>
  );
}

/** 一张码。坐标以格为单位，所以尺寸只是 width/height 的事。 */
function QrSvg({ qr, size }: { qr: QrCode; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="本页短地址的二维码"
    >
      <path fill="#1F1750" d={qr.path} />
    </svg>
  );
}

/** 放大的码：给人扫，也给人存下来印在传单和展板上。 */
function QrModal({
  qr,
  shown,
  code,
  kind,
  onClose
}: {
  qr: QrCode;
  shown: string;
  code: string;
  kind: Kind;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* 存成 PNG 而不是 SVG：要发给编辑、丢进排版软件、印在纸上的东西，PNG 到哪
     都能用。1024 够 A4 上一张三公分见方的码。 */
  const download = () => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="-2 -2 ${qr.size + 4} ${qr.size + 4}" shape-rendering="crispEdges">` +
      `<rect x="-2" y="-2" width="${qr.size + 4}" height="${qr.size + 4}" fill="#FFFFFF"/>` +
      `<path fill="#1F1750" d="${qr.path}"/></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(image, 0, 0, 1024, 1024);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `tuidang-${kind}-${code}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.src = url;
  };

  return (
    <div className="shareqr-veil" role="dialog" aria-modal="true" aria-label="扫码打开本页" onClick={onClose}>
      <div className="shareqr-card" onClick={(event) => event.stopPropagation()}>
        <p className="shareqr-title">扫码打开本页</p>
        <QrSvg qr={qr} size={200} />
        <p className="shareqr-url">{shown}</p>
        <div className="shareqr-acts">
          <button type="button" className="sharebtn" onClick={download}>
            下载图片
          </button>
          <button type="button" className="sharebtn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/* 图标一律内联。品牌标记用实心，工具用 1.6 描边 —— 两类东西本来就不是一回事。 */

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.2 8.2L23.3 22h-6.6l-5.2-6.8L5.6 22H2.5l7.7-8.8L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.6 22v-8.2h2.8l.42-3.2h-3.22V8.52c0-.93.26-1.56 1.59-1.56h1.7V4.1c-.3-.04-1.3-.13-2.47-.13-2.45 0-4.12 1.49-4.12 4.24v2.37H7.5v3.2h2.8V22h3.3Z" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.04 15.47 8.7 20.2c.5 0 .72-.22.98-.48l2.34-2.24 4.86 3.56c.89.5 1.52.24 1.76-.82l3.19-14.95c.28-1.32-.48-1.84-1.35-1.52L1.6 9.45c-1.29.5-1.27 1.22-.22 1.55l4.84 1.5 11.25-7.08c.53-.33 1.01-.15.61.19L9.04 15.47Z" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2.2c-5.46 0-9.9 4.44-9.9 9.9 0 1.74.46 3.44 1.33 4.94L2.1 21.9l4.98-1.3a9.86 9.86 0 0 0 4.96 1.33h.01c5.45 0 9.89-4.44 9.89-9.9a9.82 9.82 0 0 0-2.9-6.99 9.82 9.82 0 0 0-6.99-2.9Zm0 18.1h-.01c-1.57 0-3.11-.42-4.46-1.22l-.32-.19-3.31.87.88-3.23-.21-.33a8.2 8.2 0 0 1-1.26-4.38 8.23 8.23 0 0 1 14.05-5.82 8.17 8.17 0 0 1 2.41 5.82 8.23 8.23 0 0 1-8.22 8.23Zm4.51-6.16c-.25-.12-1.46-.72-1.69-.8-.22-.09-.39-.13-.55.12-.17.25-.63.8-.78.97-.14.16-.28.18-.53.06-.25-.12-1.04-.39-1.99-1.23-.73-.66-1.23-1.46-1.37-1.71-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.73 2.64 4.19 3.7.59.26 1.04.41 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconQr() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14" width="10" height="7" />
    </svg>
  );
}
