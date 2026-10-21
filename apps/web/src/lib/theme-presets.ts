import moJin from "@/data/theme-presets/mo-jin.json";
import moLan from "@/data/theme-presets/mo-lan.json";
import ziJin from "@/data/theme-presets/zi-jin.json";
import type { Theme } from "@/lib/theme-css";

/**
 * 一份配色，加上它的 id。
 *
 * 只有 id，没有名字 —— 名字和说明在后台的文案表里，按
 * theme.preset.<id>.name / .desc 查。
 *
 * 原来 name 和 description 也在这几个 JSON 里，于是它们写死了中文：英文站的
 * 预设选择器会显示「紫金（当前）」。把名字搬进文案表之后，JSON 里那一份就是
 * 一份没人读的重复数据 —— 重复的数据迟早会和真正在用的那份对不上，所以删掉。
 */
export interface ThemePreset extends Theme {
  _preset: { id: string };
}

/** Order matters: the first is what a fresh install looks like. */
export const THEME_PRESETS = [ziJin, moLan, moJin] as unknown as ThemePreset[];
