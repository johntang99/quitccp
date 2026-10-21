"use client";

import { useEffect, useRef, useState } from "react";
import { mirrorRewrite } from "@/lib/media-mirror";
import { t } from "@/lib/i18n";

export interface GalleryItem {
  src: string;
  alt: string;
}

/** Auto-advance interval. */
const ROTATE_MS = 5000;

/**
 * Hero gallery: one large image with a thumbnail strip underneath, advancing
 * on its own.
 *
 * Three things keep the motion from becoming a nuisance:
 * - it pauses while the pointer or keyboard focus is inside the gallery, so it
 *   cannot swap the image out from under someone who is looking at it;
 * - picking a thumbnail restarts the clock rather than advancing a moment later;
 * - `prefers-reduced-motion` stops it entirely.
 */
export function HeroGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on manual selection to restart the interval from that moment.
  const [restart, setRestart] = useState(0);
  const count = items.length;
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion.current) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, restart]);

  const select = (index: number) => {
    setActive(index);
    setRestart((n) => n + 1);
  };

  const shown = items[active] ?? items[0];
  if (!shown) return null;

  return (
    <div
      className="hero-gallery"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hero-gallery-main">
        <img src={shown.src} alt={shown.alt} />
      </div>
      {items.length > 1 ? (
        <div className="hero-gallery-thumbs" role="tablist" aria-label={t("hero.aria.gallery")}>
          {items.map((item, index) => (
            <button
              key={`${item.src}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={item.alt || t("hero.aria.image", { n: index + 1 })}
              className={index === active ? "is-active" : undefined}
              onClick={() => select(index)}
            >
              <img src={item.src} alt="" />
            </button>
          ))}
        </div>
      ) : null}
      {shown.alt ? <p className="hero-media-caption">{shown.alt}</p> : null}
      <span className="sr-only" aria-live="polite">
        {t("hero.imageOf", { n: active + 1, total: count })}
      </span>
    </div>
  );
}

function isEmbedUrl(src: string): boolean {
  return !/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i.test(src.trim());
}

/**
 * Click-to-play hero video.
 *
 * Nothing is requested until the viewer clicks. For a third-party embed that
 * matters twice over: no tracking request on page load, and a blocked host
 * (common for readers inside mainland China) cannot stall the homepage -- the
 * poster still renders and the rest of the page is unaffected.
 */
export function HeroVideo({
  src,
  poster,
  caption
}: {
  src: string;
  poster: string;
  caption: string;
}) {
  const [playing, setPlaying] = useState(false);
  const trimmed = src.trim();
  const hasVideo = trimmed.length > 0;

  if (playing && hasVideo) {
    return (
      <div className="hero-video">
        <div className="hero-video-frame">
          {isEmbedUrl(trimmed) ? (
            <iframe
              src={trimmed}
              title={caption || t("hero.videoTitle")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={trimmed} poster={poster} controls autoPlay playsInline />
          )}
        </div>
        {caption ? <p className="hero-media-caption">{caption}</p> : null}
      </div>
    );
  }

  return (
    <div className="hero-video">
      <div className="hero-video-frame">
        {poster ? <img src={poster} alt={caption || ""} /> : <div className="hero-video-placeholder" />}
        {hasVideo ? (
          <button
            type="button"
            className="hero-video-play"
            onClick={() => setPlaying(true)}
            aria-label={caption ? t("hero.aria.playNamed", { name: caption }) : t("hero.aria.play")}
          >
            <span aria-hidden="true">▶</span>
          </button>
        ) : null}
      </div>
      {caption ? <p className="hero-media-caption">{caption}</p> : null}
      {!hasVideo ? (
        <p className="hero-media-caption">{t("hero.noVideo")}</p>
      ) : null}
    </div>
  );
}

/**
 * The full-bleed hero backdrop as video instead of a photograph.
 *
 * Autoplay is only ever allowed muted -- every browser blocks a video that
 * starts making noise on its own, and none of them make an exception for a
 * backdrop. So the video starts silent and a speaker button turns sound on,
 * which works because the click is a user gesture. That is not a compromise
 * around the rule; it is the only shape autoplay can take.
 *
 * Three things make it degrade to the photograph rather than to a black box:
 * - `prefers-reduced-motion` means no autoplay. A backdrop that loops forever is
 *   exactly what that setting is about, so those readers get the still poster.
 * - the browser's data-saver flag does the same, because a hero video is the
 *   largest thing on the page and the reader has said not to spend their data.
 * - a failed load falls back to the poster image, so a missing or blocked file
 *   leaves the hero looking finished instead of empty.
 *
 * It renders the `.hero-media` backdrop layer itself rather than being dropped
 * into one, so that the speaker button can sit *outside* that layer. `.hero-media`
 * is absolutely positioned with a z-index, which makes it a stacking context:
 * a button inside it can never rise above `.hero-grid`, and the grid covers the
 * whole hero, so every click on the button landed on the grid instead.
 */
/** Where a visitor's own choice is remembered, so it outlives the visit. */
const SOUND_CHOICE_KEY = "quitccp.heroSound";

export function HeroBackgroundVideo({
  src,
  srcMobile,
  poster,
  alt,
  hasAudio,
  soundOn
}: {
  src: string;
  /**
   * 手机专用的那一支，选填。
   *
   * 首屏按 2.35:1 排版，那个比例放进竖屏手机只剩中间 35%。给一支方形的，
   * 手机上就几乎不裁。留空则手机沿用 `src`。
   *
   * 选片源交给 `<source media>`，不交给 JS：服务端渲出来就是对的，浏览器
   * 在解析 HTML 时就挑好，手机不会先去下那支桌面版再换掉。2026-10-18 在
   * Chrome 上两个方向都实测过 —— 窄屏选中手机版、宽屏跳过手机版。
   *
   * 代价是它只在加载时判断一次，不随窗口拖动重判。对真实读者无所谓（手机
   * 不会变成桌面），只有改窗口宽度的人会看到旧的那支，刷新即可。
   */
  srcMobile?: string;
  poster: string;
  alt: string;
  /** Only then is the speaker button worth showing. */
  hasAudio: boolean;
  /**
   * The centre's preference for how the backdrop should arrive.
   *
   * It is a preference and not an instruction, because no site can decide this
   * on its own -- see the unmuting effect below.
   */
  soundOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  /* Whether this reader should get motion -- not whether the element exists.
     It starts false because the server cannot know about 减少动态效果 or
     省流量模式; the effect below settles it on the client. The <video> itself
     is rendered either way, so nothing is swapped out underneath the reader. */
  const [play, setPlay] = useState(false);
  const [failed, setFailed] = useState(false);
  /**
   * 镜像没有这个文件时，退回源站再试一次。
   *
   * 站上的媒体地址在渲染时会被改写到镜像域。新上传的文件有一小段时间还没
   * 复制过去 —— 更糟的是，镜像前面那层 CDN 会把 404 缓存四小时，所以「等
   * 一会儿自己就好」并不成立。
   *
   * 页面上本来就有一个全局兜底监听器，专门干这件事：听到媒体加载失败就把
   * 地址换回源站重试。但它对这个组件无效 —— 下面的 onError 一触发就把
   * <video> 从 DOM 里摘掉换成海报，监听器还没来得及重试，元素已经没了。
   * 2026-10-17 首页视频放不出来就是这么来的：文件在源站好好的，镜像上
   * 没有，而首屏直接放弃了。
   *
   * 所以这里自己先退一步：换回源站地址重试，那一次再失败才认输去放海报。
   */
  const [useOrigin, setUseOrigin] = useState(false);
  const rule = mirrorRewrite();
  /* from/to 是子串而不是前缀 —— rewriteMediaUrl 用的是 split/join，
     形如 `//media.tdinfo.org/`，出现在 `https://media.tdinfo.org/...` 中间。 */
  const toOrigin = (url: string) => (rule && url.includes(rule.to) ? url.split(rule.to).join(rule.from) : "");
  const originSrc = toOrigin(src);
  const currentSrc = useOrigin && originSrc ? originSrc : src;

  /*
   * 候选片源，手机那支排在前面。
   *
   * `<source>` 是自上而下挑的，第一个 media 条件成立且能播的胜出，所以窄屏
   * 专用的必须在前。没有手机版时整个列表为空，下面照旧用 <video src>，那条
   * 路一个字都没改 —— 多一支片子不该让原来那条路承担任何新风险。
   */
  const mobileSrc = (srcMobile ?? "").trim();
  const sources = mobileSrc
    ? [
        { src: useOrigin && toOrigin(mobileSrc) ? toOrigin(mobileSrc) : mobileSrc, media: "(max-width: 900px)" },
        { src: currentSrc, media: undefined as string | undefined }
      ]
    : [];
  /** True once a visitor has worked the button; their choice then outranks the setting. */
  const chosen = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (reduce || connection?.saveData) return;
    setPlay(true);
  }, []);

  /*
   * Reaching for sound on arrival.
   *
   * No browser lets a page start making noise by itself, and none of them make
   * an exception for a backdrop: `play()` on an unmuted video is simply
   * rejected. So 「打开首页时就出声」 cannot be obeyed literally, and this does
   * the two things that are actually possible.
   *
   * So the backdrop starts muted and playing, every time, without asking --
   * that is the one thing no browser refuses, and it is what guarantees the
   * reader sees motion instead of a black rectangle.
   *
   * Only then is sound reached for, because the rule is not absolute: a
   * browser does allow it once the visitor has built up enough history with
   * the site (Chrome's media engagement index). If the attempt does not take,
   * the video returns to muted and keeps playing -- a silent backdrop, never
   * a stalled one.
   *
   * When it is refused, the first real click or key anywhere on the page is a
   * gesture the browser accepts, so sound is switched on then. That listener is
   * dropped the moment it fires, or if the visitor touches the speaker button
   * first: a setting must never overrule a person who has just said no.
   */
  useEffect(() => {
    if (!play || !hasAudio) return;
    const video = videoRef.current;
    if (!video) return;

    let remembered: string | null = null;
    try {
      remembered = window.localStorage.getItem(SOUND_CHOICE_KEY);
    } catch {
      /* private window, or site data blocked -- fall through to the setting */
    }
    // A visitor who has chosen before gets what they chose, either way.
    if (remembered === "off") return;
    if (remembered !== "on" && !soundOn) return;

    let cancelled = false;

    /** The state the backdrop must always end up in: silent, but moving. */
    const fallBackToSilence = () => {
      if (cancelled) return;
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => {});
    };

    /*
     * Reaching for sound without ever risking the picture.
     *
     * `play()` resolving is not the same as the video still running. On a phone
     * the promise resolves and the browser then suspends a video it will not
     * allow to be audible -- so the old code read that resolution as success,
     * set the speaker to "on", and left a black rectangle that only started
     * when the reader touched the screen. The button said sound was on; nothing
     * was playing.
     *
     * So the outcome is checked rather than assumed, and checked a beat later,
     * because the suspension lands after the promise. Anything other than
     * "still playing, still unmuted" goes back to silence.
     */
    const tryUnmute = () => {
      if (cancelled || chosen.current) return;
      if (video.paused) {
        // Not running yet: get the picture going. Sound can wait for a gesture.
        fallBackToSilence();
        return;
      }
      video.muted = false;
      void video.play().then(
        () => {
          window.setTimeout(() => {
            if (cancelled || chosen.current) return;
            if (video.paused || video.muted) fallBackToSilence();
            else setMuted(false);
          }, 300);
        },
        fallBackToSilence
      );
    };

    /* Muted first, always. It is the one thing no browser refuses, so the
       backdrop is already moving before anything is attempted on top of it. */
    fallBackToSilence();

    const onGesture = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      tryUnmute();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [play, hasAudio, soundOn]);

  /*
   * Start the picture.
   *
   * This used to be the `autoPlay` attribute, which only worked because the
   * element was mounted at the same moment it was wanted. Now the element is
   * server-rendered and waits here instead -- which is what removes the hand-
   * off that showed a still first: the <img> was swapped for a <video> once
   * React hydrated, and only then did the video start loading, so the hero sat
   * on its poster for a third of a second before the first frame arrived.
   *
   * `preload` is raised to "auto" only once motion is wanted, so a reader on
   * 省流量模式 or 减少动态效果 never pays to download a film they will not see.
   */
  /*
   * 接管 <head> 里那个兜底脚本已经做掉的退避。
   *
   * 镜像的 404 多半在 HTML 还在解析时就回来了，那时 React 根本没水合，下面
   * 那个 onError 听不到 —— 真正救回来的是 media-failover.ts 那个监听器，它
   * 直接改了 DOM 上的 src。问题是 React 水合时拿自己渲染的地址去对 DOM，
   * 对不上就报一条「hydrated but some attributes didn't match」。
   *
   * 所以这里在挂载时看一眼 DOM 上现在是什么：已经被换成源站地址了，就把这个
   * 事实收进 state。这样 React 和 DOM 说的是同一件事，后面任何一次重渲染也
   * 不会把镜像地址再写回去。<video> 上的 suppressHydrationWarning 配套：
   * 这个属性确实允许和服务端不一致，而且那正是我们要的结果。
   */
  const adopted = useRef(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !rule || !originSrc) return;
    /* 看 currentSrc 而不是 src 属性：有手机版时地址在 <source> 上，src 属性
       是空的。currentSrc 是浏览器最终选中的那一个，两种写法都准。
       `originSrc` 非空保证我们渲出去的本来就是镜像地址 —— 编辑要是贴了个
       外站地址，它本来就不含镜像域，不该被当成「已经退避过了」。 */
    if (video.currentSrc && !video.currentSrc.includes(rule.to)) {
      adopted.current = true;
      setUseOrigin(true);
    }
  }, [originSrc, rule]);

  /*
   * 自己换地址时，要显式 load() —— 改 src 属性不保证浏览器重新取。
   *
   * load() 会把播放位置清零并且停下来，所以紧接着要再起一次：按 play 跑的那个
   * effect 只在 play 变化时触发，退回源站的时候它早就跑完了。少了这一步，退回
   * 来的片子能加载、能显示第一帧，但一直停在那儿不动。
   *
   * 上面那条路（兜底脚本已经换好了）不走这里：它已经在取了，再 load() 一次是
   * 白扔一次请求，而起播由 play 那个 effect 负责。
   */
  useEffect(() => {
    if (!useOrigin) return;
    const video = videoRef.current;
    if (!video) return;
    if (adopted.current) {
      adopted.current = false;
      return;
    }
    try {
      video.load();
    } catch {
      /* 取不到就算了，海报还在 */
      return;
    }
    if (play) {
      video.preload = "auto";
      void video.play().catch(() => {});
    }
  }, [useOrigin, play]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !play) return;
    video.preload = "auto";
    video.muted = true;
    void video.play().catch(() => {});
  }, [play]);

  // Driven from state rather than set once on the element: the muted attribute
  // and the property can disagree after hydration, and the property is the one
  // the browser actually plays by.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, play]);

  /** The visitor's own call: applied, remembered, and final. */
  const toggleSound = () => {
    chosen.current = true;
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(SOUND_CHOICE_KEY, next ? "off" : "on");
    } catch {
      /* not being able to remember it is no reason not to honour it now */
    }
  };

  /* Only a video that cannot load falls back to a still. Everything else --
     including a reader who has asked for no motion -- gets the <video>
     element, showing its poster. See the mounting note on `play` above. */
  if (failed) {
    return poster ? (
      <div className="hero-media">
        <img src={poster} alt={alt} />
      </div>
    ) : null;
  }

  return (
    <>
      <div className="hero-media">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          /* 有手机版时地址放在 <source> 上 —— src 属性一旦存在就会压过所有
             <source>，媒体查询就白写了。 */
          src={sources.length ? undefined : currentSrc}
          key={sources.length ? "sources" : "src"}
          poster={poster}
          /* 水合之前，<head> 里的兜底脚本可能已经把 src 换成源站地址了。那是
             对的，不是要修的不一致 —— 上面的 adopt effect 负责把它收进 state。 */
          suppressHydrationWarning
          /* No `autoPlay` attribute: whether this reader gets motion is the
             effect's call, not the markup's. The element is here from the
             first byte of HTML all the same, which is the point. */
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          onError={(event) => {
            /*
             * 只认 <video> 自己报的错，不认 <source> 报的。
             *
             * 这是 2026-10-18 加手机版片源时踩到的：规范里资源选择算法逐个
             * 看 <source>，凡是被 media 条件排除掉的，都要「fire an event
             * named error at the candidate」—— 也就是说，手机那支在桌面上
             * 被跳过，是正常流程，但它会触发一个 error 事件。
             *
             * error 不冒泡，可是它走捕获阶段，而 React 在根节点上监听，于是
             * 这个事件照样被派发到祖先 <video> 的 onError 上。结果是：桌面
             * 上一打开首页，手机那支被跳过 → 报错 → 首屏判定失败 → 整个
             * <video> 被摘掉换成海报。视频在，地址对，就是不显示。
             *
             * target 和 currentTarget 不同就说明错在某个 <source> 身上，那
             * 不是失败，是选片源的正常过程。真的所有候选都用不了时，浏览器
             * 会在 <video> 自己身上再报一次，那一次 target === currentTarget。
             */
            if (event.target !== event.currentTarget) return;
            /* 第一次失败且确实有源站地址可退 —— 换地址重试，不要放弃。 */
            if (!useOrigin && originSrc) {
              setUseOrigin(true);
              return;
            }
            setFailed(true);
          }}
        >
          {sources.map((s) => (
            <source key={s.src} src={s.src} media={s.media} type="video/mp4" />
          ))}
        </video>
      </div>
      {hasAudio ? (
        <button
          type="button"
          className="hero-sound"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? t("hero.soundOn") : t("hero.soundOff")}
          title={muted ? t("hero.soundOn") : t("hero.soundOff")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            {muted ? (
              <path d="m17 9 4 6M21 9l-4 6" />
            ) : (
              <>
                <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19 6a8.5 8.5 0 0 1 0 12" />
              </>
            )}
          </svg>
        </button>
      ) : null}
    </>
  );
}
