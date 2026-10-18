"use client";

import { useEffect, useState } from "react";

/**
 * 量一下编辑贴进来的视频是什么比例，不对就当场说。
 *
 * ## 为什么要有这个
 *
 * 首屏的排版按 2.35:1 做（见 globals.css 里 `--hero-photo-base` 那段）。框和
 * 片子同比例，`object-fit: cover` 才裁不到东西。可是没有任何东西拦着编辑贴
 * 一支 16:9 的进来 —— 贴了也能放，只是上下被默默裁掉约 24%，而画面本来就
 * 是动的，少了一截谁也看不出来。2026-10-18 之前线上就一直是这个状态。
 *
 * 所以这里不拦，只量、只说。比例是编辑能判断的事：他知道那支片子重要的
 * 东西在哪儿，知道裁掉 24% 要不要紧。他需要的只是有人告诉他「会裁 24%」。
 *
 * ## 为什么能在浏览器里量
 *
 * `videoWidth`/`videoHeight` 读的是解码出来的尺寸，不碰像素，所以跨域也拿
 * 得到，不需要 CORS 头。`preload="metadata"` 只取文件头那几十 KB，不会把
 * 整支片子拖下来。
 */

/** 首屏桌面版的规格。改这里之前先改 globals.css 里那个 2.35。 */
export const HERO_RATIO = 2.35;
/** 手机版的规格：方形。竖屏上横向视频必然裁左右，方形是裁得最少的折中。 */
export const HERO_MOBILE_RATIO = 1;

/** 比例差多少才值得提。差 2% 以内肉眼看不出，提了反而是噪音。 */
const TOLERANCE = 0.02;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; w: number; h: number }
  | { kind: "failed" };

export function VideoRatioHint({
  src,
  target,
  targetLabel
}: {
  src: string;
  /** 这个位置期望的宽高比。 */
  target: number;
  /** 说给人听的名字，例如「2.35:1（1920×816）」。 */
  targetLabel: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    const url = src.trim();
    if (!url || !/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i.test(url)) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    /* 元素不进 DOM —— 它只是个量尺，不该在后台界面上占位置或被看见。 */
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    let done = false;
    const finish = (next: State) => {
      if (done) return;
      done = true;
      probe.removeAttribute("src");
      probe.load();
      setState(next);
    };
    probe.onloadedmetadata = () =>
      finish(
        probe.videoWidth > 0
          ? { kind: "ok", w: probe.videoWidth, h: probe.videoHeight }
          : { kind: "failed" }
      );
    probe.onerror = () => finish({ kind: "failed" });
    /* 地址打不开、或者对方不回元数据时，不要永远停在「量不出来」。 */
    const timer = window.setTimeout(() => finish({ kind: "failed" }), 15000);
    probe.src = url;
    return () => {
      window.clearTimeout(timer);
      finish({ kind: "idle" });
    };
  }, [src]);

  if (state.kind === "idle") return null;
  if (state.kind === "loading") return <Note tone="plain">正在读取视频尺寸…</Note>;
  if (state.kind === "failed") {
    return (
      <Note tone="plain">
        读不到这支视频的尺寸，没法检查比例。地址可能打不开，或者对方不允许跨站读取——
        这不一定代表首页也放不出来，但保存后请自己看一眼首页。
      </Note>
    );
  }

  const { w, h } = state;
  const ratio = w / h;
  const off = Math.abs(ratio - target) / target;

  if (off <= TOLERANCE) {
    return (
      <Note tone="good">
        ✅ {w}×{h}（{ratio.toFixed(2)}:1），正好是 {targetLabel} 的规格，不会被裁。
      </Note>
    );
  }

  /* 框按 target 排版，片子按 cover 填进去：谁相对更「长」就裁谁。 */
  const cropY = ratio < target ? 1 - ratio / target : 0;
  const cropX = ratio > target ? 1 - target / ratio : 0;

  return (
    <Note tone="warn">
      ⚠️ 这支是 {w}×{h}（<strong>{ratio.toFixed(2)}:1</strong>），这个位置按{" "}
      <strong>{targetLabel}</strong> 排版。
      {cropY > 0 ? (
        <>
          {" "}
          上下会被裁掉约 <strong>{Math.round(cropY * 100)}%</strong>。
        </>
      ) : null}
      {cropX > 0 ? (
        <>
          {" "}
          左右会被裁掉约 <strong>{Math.round(cropX * 100)}%</strong>。
        </>
      ) : null}
      <span style={{ display: "block", marginTop: 6 }}>
        不是不能用 —— 画面主体在正中间的话，裁掉边角看不出来。要完全不裁，去
        「影片拼接台」把项目的输出尺寸改成 {targetLabel} 重出一支。
      </span>
    </Note>
  );
}

function Note({ tone, children }: { tone: "good" | "warn" | "plain"; children: React.ReactNode }) {
  const palette = {
    good: { background: "#f1f8f2", border: "#bcdcc2", color: "#2f6137" },
    warn: { background: "#fdf8ef", border: "#e3cb9b", color: "#8a6420" },
    plain: { background: "#f6f6f7", border: "#dcdce0", color: "#5a5a63" }
  }[tone];
  return (
    <p
      style={{
        margin: 0,
        padding: "9px 11px",
        borderRadius: 6,
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 12,
        lineHeight: 1.7
      }}
    >
      {children}
    </p>
  );
}
