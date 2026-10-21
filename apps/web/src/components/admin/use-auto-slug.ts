"use client";

import { useEffect } from "react";

/**
 * 让 slug 跟着标题走，顺手把中文转成拼音。
 *
 * 原来只有「资料」用它，其余三个库刻意保留中文地址。那个判断在 2026-10 被读者
 * 的抱怨推翻了：中文地址一经编码就是一堵百分号，贴到哪里都显示成乱码。现在
 * 文章和视频也走这里，连同存量 16,218 条一起改成拼音。
 *
 * 常见问答还没改 —— 它的地址没有日期前缀，同名问题会直接撞在一起，得先想清楚
 * 那一边的撞名规则。
 *
 * The romanisation needs a pinyin dictionary, which lives on the server, so the
 * suggestion is fetched rather than computed here.
 *
 * The fallback matters more than it looks. If the request fails -- offline, a
 * dropped session, a dev server restarting mid-keystroke -- the field still
 * gets a usable slug from the local rules, which is exactly what the editors
 * had before. A slug box that silently stops following the title would be a
 * worse failure than one that occasionally suggests the old shape.
 */

/* 短记号的字母表，和服务端一致：去掉了 0/O、1/l/I 这些念出来会混的。 */
const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * 离线兜底用的短记号。
 *
 * djb2，不是 sha256 —— 浏览器里的 crypto.subtle 是异步的，而这个函数要在输入
 * 的每一次按键之间同步返回。算出来的记号和服务端的不一样，这没关系：接口一旦
 * 恢复，下一次按键就会用服务端的结果覆盖它。这里要保证的只有一件事 ——
 * **任何情况下都不产生非 ASCII 的地址**。
 */
function localToken(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < 7; i += 1) {
    out += TOKEN_ALPHABET[h % TOKEN_ALPHABET.length];
    h = Math.floor(h / TOKEN_ALPHABET.length) + 0x9e3779b9;
  }
  return out;
}

/**
 * 接口不通时在本地算一个地址。
 *
 * 以前这里保留 CJK 字符，于是接口一挂，编辑就会拿到一个中文地址 —— 正是整个
 * 拼音改造要消灭的东西，而且它会一路存进数据库。现在只留 ASCII：拉丁字母原样
 * 用，其余（中文、日文、泰文）一律退到短记号。
 *
 * 拼音在这里算不出来：pinyin-pro 解包约一兆，不该为了一个兜底路径塞给浏览器。
 * 所以中文标题在离线时拿到的是记号而不是拼音 —— 接口恢复后会被覆盖成拼音。
 */
function localSlug(title: string, withDate: boolean, at?: string | null): string {
  const latin = title
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "-")
    .replace(/[^0-9a-z-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  /* 拉丁部分太短就说明这个标题基本不是拉丁文字，用记号更诚实。 */
  const base = latin.replace(/-/g, "").length >= 3 ? latin : localToken(title.trim());
  if (!base || !withDate) return base;
  /* 和服务端一样按 UTC 取年月日：站上现有的日期前缀都是 UTC，而且线上跑在
     Vercel（服务器时区就是 UTC）。用本地时钟会让编辑在纽约深夜建的那一篇，
     前缀比服务端算出来的早一天。 */
  const when = at ? new Date(at) : new Date();
  const day = Number.isNaN(when.getTime()) ? new Date() : when;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}-${base}`;
}

/**
 * 取一次拼音地址。
 *
 * 「由标题重新生成」那颗按钮也要走拼音，而它按下的同时把 slug 标记成「用户
 * 动过」，于是上面那个 hook 就停了 —— 所以单独留一个能直接调的版本，两边共用
 * 同一条规则，不会一个转拼音另一个不转。
 */
export async function requestSlug(
  title: string,
  options: { withDate: boolean; at?: string | null; signal?: AbortSignal }
): Promise<string> {
  const { withDate, at, signal } = options;
  const query = new URLSearchParams({ title, date: withDate ? "1" : "0" });
  if (at) query.set("at", at);
  const response = await fetch(`/api/admin/slug?${query}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as { slug?: string };
  return typeof data.slug === "string" && data.slug ? data.slug : localSlug(title, withDate, at);
}

/**
 * 把地址开头的日期换成这一天，主体一个字不动。
 *
 * ## 为什么需要它
 *
 * 新建表单的发布时间默认「现在」，编辑先输标题、地址按「现在」生成，之后才把
 * 发布时间回填成真正的那一天 —— 可这时地址多半已经被标记成「动过」，跟着标题
 * 走的那个钩子就停了，于是地址上留着创建当天的日期。
 *
 * 2026-10-21 查出 20 条是这么来的：slug 前缀 10-21，发布时间却是 10-20。
 * 不报错，只是地址上的日期和这篇内容的日期对不上 —— 而日期前缀存在的全部意义
 * 就是标出它是哪一天的内容。
 *
 * ## 为什么只换日期段，不重新生成整个地址
 *
 * 重新生成会把编辑手工改过的主体一起冲掉。把标题改短、把地址改顺口，是编辑
 * 常做的事；因为改了一下发布时间就把它抹掉，比日期不对更糟。
 *
 * 没有日期前缀的地址（编辑自己写的、或者没勾「加日期」）原样返回。
 */
export function retargetSlugDate(slug: string, at?: string | null): string {
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(slug.trim());
  if (!m) return slug;
  const when = at ? new Date(at) : new Date();
  if (Number.isNaN(when.getTime())) return slug;
  const pad = (n: number) => String(n).padStart(2, "0");
  /* UTC，和服务端 datePrefix 以及 localSlug 保持一致。 */
  const day = `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())}`;
  return day === m[1] ? slug : `${day}-${m[2]}`;
}

export function useAutoSlug(
  title: string,
  options: { enabled: boolean; withDate: boolean; at?: string | null },
  onSlug: (slug: string) => void
) {
  const { enabled, withDate, at } = options;

  useEffect(() => {
    if (!enabled) return;
    if (!title.trim()) {
      onSlug("");
      return;
    }

    const controller = new AbortController();
    /* Typing a title fires this on every keystroke; 350ms is long enough that
       a normal phrase costs one request rather than a dozen. */
    const timer = setTimeout(async () => {
      try {
        onSlug(await requestSlug(title, { withDate, at, signal: controller.signal }));
      } catch (error) {
        /* An abort is this effect being superseded by the next keystroke, not
           a failure -- answering it would overwrite the newer suggestion. */
        if ((error as Error)?.name === "AbortError") return;
        onSlug(localSlug(title, withDate, at));
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, enabled, withDate, at]);
}
