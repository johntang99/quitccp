"use client";

import { useEffect, useRef, useState } from "react";
import { HeroBackgroundVideo } from "@/components/public/HeroMedia";

/**
 * 首屏比例试验台的内容。见 app/hero-lab/page.tsx 的说明。
 *
 * 结构和 HomeTemplate 的首屏逐字对齐：`hero hero--full-bleed` 外壳、
 * `.hero-media` 背景层、`.hero-scrim`、`.wrap hero-grid` 文案卡片。只有
 * <video> 换成了朴素写法 —— HeroBackgroundVideo 那套退避、静音、喇叭按钮
 * 都不影响几何，而少掉它们这里的读数更干净。
 */

/** 三支片子内容完全相同，都从同一支 16:9 原片裁出来，所以差异只在比例。 */
const CLIPS = {
  "16:9": {
    src: "https://media.tdinfo.org/home/1792277018668-new-video2-1920.mp4",
    label: "16:9　1920×1080　（线上现用）"
  },
  "2.35:1": {
    src: "https://media.tdinfo.org/home/lab-235-1920x816.mp4",
    label: "2.35:1　1920×816　（上下各裁 132px）"
  }
} as const;

/** 手机专用的那一支：从原片居中裁 1080×1080，保留完整高度。 */
const MOBILE_SRC = "https://media.tdinfo.org/home/lab-square-1080.mp4";

type ClipKey = keyof typeof CLIPS;

/**
 * 两种首屏高度算法。
 *
 * `fixed` 是线上现状：写死 780px（手机 420px）。宽屏上框越来越扁，于是 16:9
 * 的片子上下被裁得越来越狠 —— 1920 屏裁 28%，2560 屏裁 46%。
 *
 * `aspect` 是提案，三段夹出来的：
 *
 *   max( 420px , min( 100vw/2.35 , 100svh − 139px ) )
 *        └ 手机下限      └ 不裁上下        └ 不超出一屏
 *
 * 139px = 首屏上方那条头部（实测 84px）加菜单栏（--menubar-h，55px）。实测
 * 过桌面和手机，这个偏移都是常数，所以可以写死；但它跟着头部走，哪天头部
 * 改高了，这个数也要跟着改。
 *
 * 下限 420px 的作用是把手机挡在公式外面：390px 宽的屏按 2.35 算只有 166px
 * 高，首屏会变成一条细缝。竖屏上横向视频必然裁左右，这是几何决定的，只能
 * 靠「重要内容居中」的安全区去兜，不能靠调高度。
 */
const LAYOUTS = {
  fixed: { css: "780px", label: "现状　写死 780px（手机 420px）" },
  aspect: {
    css: "max(420px, min(calc(100vw / 2.35), calc(100svh - 139px)))",
    label: "提案　max(420px, min(100vw÷2.35, 100svh−139px))"
  }
} as const;

type LayoutKey = keyof typeof LAYOUTS;

interface Readout {
  vw: number;
  vh: number;
  boxW: number;
  boxH: number;
  natW: number;
  natH: number;
  cropX: number;
  cropY: number;
  /** 浏览器最终选中的那个地址的文件名 —— 验证手机版有没有真的被挑中。 */
  file: string;
}

function measure(video: HTMLVideoElement): Readout | null {
  const box = video.parentElement;
  if (!box || !video.videoWidth) return null;
  const { width: boxW, height: boxH } = box.getBoundingClientRect();
  const natW = video.videoWidth;
  const natH = video.videoHeight;
  /* object-fit: cover —— 放大到刚好盖满，较长的那一边溢出，溢出部分被裁。 */
  const scale = Math.max(boxW / natW, boxH / natH);
  const renderedW = natW * scale;
  const renderedH = natH * scale;
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    boxW,
    boxH,
    natW,
    natH,
    cropX: renderedW > boxW ? (renderedW - boxW) / renderedW : 0,
    cropY: renderedH > boxH ? (renderedH - boxH) / renderedH : 0,
    file: (video.currentSrc || "").split("/").pop() ?? ""
  };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const ratio = (w: number, h: number) => (h > 0 ? (w / h).toFixed(2) : "–");

export function HeroLab() {
  const [clip, setClip] = useState<ClipKey>("2.35:1");
  const [layout, setLayout] = useState<LayoutKey>("aspect");
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [mobile, setMobile] = useState(false);
  const [read, setRead] = useState<Readout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /* 窗口一变就重新量 —— 这个页面的全部意义就是看着数字随窗口变化。 */
  useEffect(() => {
    const update = () => {
      /* 真实首屏组件自己渲染 .hero-media，所以这里按选择器找，不持有 ref。 */
      const v = document.querySelector<HTMLVideoElement>(".hero-media video");
      if (v) {
        videoRef.current = v;
        setRead(measure(v));
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
    };
  }, [clip, layout, fit, mobile]);

  const verdictCrop = read && read.cropY < 0.005;
  const verdictFit = read && read.boxH <= read.vh;

  return (
    <>
      <section
        className="hero hero--full-bleed"
        style={{ ["--hero-photo-base" as string]: LAYOUTS[layout].css }}
      >
        {/* object-fit 的切换只在这个试验台里有意义，线上永远是 cover —— 所以
            用一条注入的样式覆盖，而不是给首屏组件加一个没人会用的参数。 */}
        <style>{`.hero-media video { object-fit: ${fit} !important; background: #1a1333; }`}</style>
        {/* 用的就是首页那个组件本身：换片源、退回源站、水合这几件事都在它
            里面，另写一个「差不多的」来测就测不到它们。 */}
        <HeroBackgroundVideo
          key={`${clip}-${mobile}`}
          src={CLIPS[clip].src}
          srcMobile={mobile ? MOBILE_SRC : undefined}
          poster=""
          alt="首屏比例试验"
          hasAudio={false}
          soundOn={false}
        />
        <div className="hero-scrim" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--onink">首屏比例试验台 · 仅开发环境</p>
            <h1>
              8月115万人“三退”：
              <br />
              从苦难与谎言中觉醒
            </h1>
            <p>
              这段文字和首页等长，用来检查换了比例之后卡片还压不压得住画面、标题会不会
              被推到折线以下。真实首页的文案长度会变，这里取的是当前线上那一版。
            </p>
            <div className="hero-cta">
              <a className="btn btn--seal" href="#panel">
                看读数
              </a>
              <a className="btn btn--line-light" href="/">
                对比真首页
              </a>
            </div>
          </div>
        </div>
      </section>

      <div
        id="panel"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 999,
          width: 330,
          maxWidth: "calc(100vw - 32px)",
          background: "rgba(16,10,38,.94)",
          color: "#f4f1ea",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 6,
          padding: "14px 16px",
          font: "13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 32px rgba(0,0,0,.4)"
        }}
      >
        <Group label="视频">
          {(Object.keys(CLIPS) as ClipKey[]).map((k) => (
            <Pick key={k} on={clip === k} onClick={() => setClip(k)}>
              {k}
            </Pick>
          ))}
        </Group>
        <Group label="首屏高度">
          {(Object.keys(LAYOUTS) as LayoutKey[]).map((k) => (
            <Pick key={k} on={layout === k} onClick={() => setLayout(k)}>
              {k === "fixed" ? "780px" : "按比例"}
            </Pick>
          ))}
        </Group>
        <Group label="object-fit">
          {(["cover", "contain"] as const).map((k) => (
            <Pick key={k} on={fit === k} onClick={() => setFit(k)}>
              {k}
            </Pick>
          ))}
        </Group>
        <Group label="手机版">
          <Pick on={!mobile} onClick={() => setMobile(false)}>
            不给
          </Pick>
          <Pick on={mobile} onClick={() => setMobile(true)}>
            给方形
          </Pick>
        </Group>

        <div style={{ margin: "12px 0 8px", opacity: 0.6, fontSize: 11 }}>
          {CLIPS[clip].label}
          <br />
          {LAYOUTS[layout].label}
        </div>

        {read ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <tbody>
              <Row k="视口" v={`${read.vw} × ${read.vh}`} note={ratio(read.vw, read.vh)} />
              <Row k="首屏框" v={`${Math.round(read.boxW)} × ${Math.round(read.boxH)}`} note={ratio(read.boxW, read.boxH)} />
              <Row k="视频原始" v={`${read.natW} × ${read.natH}`} note={ratio(read.natW, read.natH)} />
              <Row k="上下裁掉" v={pct(read.cropY)} bad={read.cropY >= 0.005} />
              <Row k="左右裁掉" v={pct(read.cropX)} />
              <Row k="实际在放" v={read.file} />
            </tbody>
          </table>
        ) : (
          <div style={{ opacity: 0.6 }}>量不到，等视频加载…</div>
        )}

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.14)" }}>
          <Verdict ok={!!verdictCrop}>要求 1　上下不被裁</Verdict>
          <Verdict ok={!!verdictFit}>要求 2　不超过一屏高</Verdict>
        </div>
      </div>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ width: 62, flex: "none", opacity: 0.55, fontSize: 11 }}>{label}</span>
      {children}
    </div>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "4px 6px",
        borderRadius: 3,
        border: `1px solid ${on ? "#e8c77a" : "rgba(255,255,255,.22)"}`,
        background: on ? "rgba(232,199,122,.18)" : "transparent",
        color: on ? "#e8c77a" : "#f4f1ea",
        font: "inherit",
        fontSize: 12,
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

function Row({ k, v, note, bad }: { k: string; v: string; note?: string; bad?: boolean }) {
  return (
    <tr>
      <td style={{ opacity: 0.55, padding: "2px 0", fontSize: 11 }}>{k}</td>
      <td style={{ textAlign: "right", padding: "2px 0", color: bad ? "#ff9b8a" : undefined }}>{v}</td>
      {note ? (
        <td style={{ textAlign: "right", padding: "2px 0 2px 10px", opacity: 0.45, fontSize: 11 }}>{note}</td>
      ) : (
        <td />
      )}
    </tr>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12 }}>
      <span style={{ color: ok ? "#8fe3a8" : "#ff9b8a" }}>{ok ? "✅" : "❌"}</span>
      <span style={{ opacity: 0.85 }}>{children}</span>
    </div>
  );
}
