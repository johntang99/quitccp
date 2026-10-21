"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { createPortal } from "react-dom";

/**
 * 「为什么是 2.35」这件事，说给编辑听。
 *
 * 出片比例那三个按钮上只写得下一行字，而这个选择背后有一个不直观的事实：
 * **两种比例最后被砍掉的像素一样多**。16:9 看着「没裁」，只是因为裁发生在
 * 读者的浏览器里，出片的人看不见。把这件事讲清楚，编辑才有可能自己做对
 * 决定，而不是记住一条「选第一个」的口诀。
 *
 * ## 为什么是弹窗，不是一段说明文字
 *
 * 那一屏上已经有七八段灰色小字了。再加一段，它就是第九段 —— 没人会读第九段。
 * 收进弹窗，想看的人点一下，不想看的人不用绕过它。
 *
 * ## 为什么图是 CSS 画的
 *
 * 用截图的话，首屏布局一改它就过期，而且没人会记得回来换。这几个方块是按
 * 真实比例算出来的（16:9 = 1.78，2.35，首屏框按 2.2 左右），布局怎么变它
 * 都还是对的，也不用管图片存哪儿。
 */

/** 实测数据，2026-10-18 在试验台上量的。改这里之前先去 /hero-lab 重新量。 */
const MEASURED = [
  { screen: t("ratio.screen.laptop"), r169: "29%", r235: "6%" },
  { screen: t("ratio.screen.desktop"), r169: "20%", r235: "0%" },
  { screen: t("ratio.screen.wide"), r169: "21%", r235: "0%" }
];

export function AspectRatioHelp() {
  const [open, setOpen] = useState(false);
  /* 服务端没有 document，portal 要等挂载之后才能建。 */
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  /* Esc 关掉，是弹窗最基本的一条 —— 键盘用的人指望它。 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          marginLeft: 8,
          font: "inherit",
          fontSize: 12,
          color: "#5b4ba8",
          textDecoration: "underline",
          textUnderlineOffset: 2,
          cursor: "pointer"
        }}
      >
        {t("ratio.why")}
      </button>

      {/*
        挂到 body 上，不留在原地。

        `position: fixed` 的定位基准不一定是视口 —— 只要祖先里有 transform、
        filter 或 contain，它就改成相对那个祖先。后台这一页正好是这种情况：
        弹窗留在原地时顶部被切在视口外面，而 86vh 的高度上限也跟着失效。
        portal 把它挂到 body 下，祖先那些属性就够不着它了。
      */}
      {open && mounted
        ? createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(16,10,38,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("ratio.title")}
            /* 点面板本身不该关掉它 —— 只有点外面才算「我看完了」。 */
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 8,
              maxWidth: 680,
              width: "100%",
              maxHeight: "86vh",
              overflowY: "auto",
              padding: "26px 30px 30px",
              boxShadow: "0 18px 50px rgba(0,0,0,.3)",
              outline: "none",
              lineHeight: 1.8
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 19 }}>{t("ratio.title")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#888", padding: 4 }}
                aria-label={t("ratio.close")}
              >
                ×
              </button>
            </div>

            <p style={{ margin: "14px 0 0", fontSize: 15 }}>
              {tRich("ratio.conclusion", {
                same: <strong>{t("ratio.conclusionSame")}</strong>,
                who: <strong>{t("ratio.conclusionWho")}</strong>
              })}
            </p>

            <Diagram />

            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#555" }}>
              {tRich("ratio.heroShape", { always: <strong>{t("ratio.heroShapeAlways")}</strong> })}
            </p>

            <h4 style={{ margin: "22px 0 8px", fontSize: 15 }}>{t("ratio.tableTitle")}</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#666" }}>
                  <th style={th}>{t("ratio.col.screen")}</th>
                  <th style={{ ...th, textAlign: "right" }}>{t("ratio.col.169")}</th>
                  <th style={{ ...th, textAlign: "right" }}>{t("ratio.col.235")}</th>
                </tr>
              </thead>
              <tbody>
                {MEASURED.map((row) => (
                  <tr key={row.screen}>
                    <td style={td}>{row.screen}</td>
                    <td style={{ ...td, textAlign: "right", color: "#a33" }}>{row.r169}</td>
                    <td style={{ ...td, textAlign: "right", color: "#2f6137", fontWeight: 600 }}>{row.r235}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#777" }}>
              {t("ratio.measuredNote")}
            </p>

            <h4 style={{ margin: "22px 0 8px", fontSize: 15 }}>{t("ratio.phoneTitle")}</h4>
            <p style={{ margin: 0, fontSize: 13.5, color: "#444" }}>
              {tRich("ratio.phoneBody", {
                both: <strong>{t("ratio.phoneBodyBoth")}</strong>,
                square: <strong>{t("ratio.phoneBodySquare")}</strong>
              })}
            </p>

            <h4 style={{ margin: "22px 0 8px", fontSize: 15 }}>{t("ratio.when169Title")}</h4>
            <p style={{ margin: 0, fontSize: 13.5, color: "#444" }}>
              {tRich("ratio.when169Body", { notHero: <strong>{t("ratio.when169NotHero")}</strong> })}
            </p>

            <p style={{ margin: "22px 0 0", fontSize: 13, color: "#777", borderTop: "1px solid #eee", paddingTop: 14 }}>
              {t("ratio.footer")}
            </p>
          </div>
        </div>,
            document.body
          )
        : null}
    </>
  );
}

const th: React.CSSProperties = { padding: "6px 0", fontWeight: 500, borderBottom: "1px solid #e6e6ea" };
const td: React.CSSProperties = { padding: "7px 0", borderBottom: "1px solid #f2f2f5" };

/**
 * 两个框的对照图。
 *
 * 左边：16:9 的成片放进首屏的条里，上下各一条红的表示浏览器切掉的部分。
 * 右边：2.35 的成片，整张都在。
 *
 * 比例是算出来的不是画出来的：条宽固定，16:9 的片子高度 = 宽/1.78，首屏条
 * 高度 = 宽/2.2（取各档屏幕的中间值），所以红带的厚度就是真实的裁切比例。
 */
function Diagram() {
  const W = 268;
  const barH = Math.round(W / 2.2); // 首屏条
  const filmH = Math.round(W / 1.78); // 16:9 成片按宽度放进来之后的高度
  const cut = Math.round((filmH - barH) / 2); // 上下各被切掉这么多

  return (
    <div style={{ display: "flex", gap: 22, margin: "20px 0 14px", flexWrap: "wrap" }}>
      <figure style={{ margin: 0 }}>
        <div style={{ position: "relative", width: W, height: filmH, borderRadius: 4, overflow: "hidden", background: "linear-gradient(135deg,#c9b89a,#9a8ab0)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: cut, background: "rgba(200,40,40,.62)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: cut, background: "rgba(200,40,40,.62)" }} />
          {/* 字幕横跨在裁切线上 —— 不是「躲在红带上面」，而是被它切成两半。
              这就是整张图要说的事，位置摆错了图就白画了。 */}
          <span style={{ position: "absolute", left: 0, right: 0, bottom: cut - 7, textAlign: "center", color: "#fff", fontSize: 11, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
            字幕在这儿
          </span>
        </div>
        <figcaption style={{ fontSize: 12.5, marginTop: 7, color: "#555" }}>
          <strong>出 16:9</strong>
          <span style={{ display: "block", color: "#a33" }}>红的是浏览器切掉的，永远正中间</span>
        </figcaption>
      </figure>

      <figure style={{ margin: 0 }}>
        <div style={{ width: W, height: barH, borderRadius: 4, background: "linear-gradient(135deg,#c9b89a,#9a8ab0)", position: "relative" }}>
          <span style={{ position: "absolute", left: 0, right: 0, bottom: 6, textAlign: "center", color: "#fff", fontSize: 11, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
            字幕在这儿
          </span>
        </div>
        <figcaption style={{ fontSize: 12.5, marginTop: 7, color: "#555" }}>
          <strong>出 2.35</strong>
          <span style={{ display: "block", color: "#2f6137" }}>一刀都不用切，你出片时就定好了</span>
        </figcaption>
      </figure>
    </div>
  );
}
