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

/** The old behaviour, kept as the offline answer. ASCII and CJK, nothing else. */
function localSlug(title: string, withDate: boolean, at?: string | null): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "-")
    .replace(/[^0-9a-z㐀-䶿一-鿿-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
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
