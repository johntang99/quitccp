import { randomInt } from "node:crypto";

/**
 * 可分享的短码。
 *
 * 公开地址是中文标题，编码之后是一堵 %E4%B8 —— 实测最长的一条视频地址 611 个
 * 字符。短码把它压到 34：
 *
 *   /news/8%E6%9C%88115%E4%B8%87%E4%BA%BA…   168 字符
 *   /a/k3m9x2p                                34 字符
 *
 * 短码指向的是那一行数据，不是地址。所以将来把全站地址改成拼音时，已经分享
 * 出去的短链一条都不会断。正因如此，**发出去的短码不能再改，也不能回收重用**。
 */

/**
 * 字母表里没有 0/O/o 和 1/l/I。
 *
 * 这些链接会被印在传单和展板上、被人用眼睛抄、被念出来 —— 现场征签的志愿者
 * 递出去一张纸，上面的 l 和 1 分不清就等于递了个死链。去掉之后还剩 56 个字符，
 * 7 位是 1.7 万亿种组合，对一万多条内容绰绰有余。
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const LENGTH = 7;

/**
 * 一个新短码。
 *
 * 用 `randomInt` 而不是 `Math.random()`：不是因为这里需要密码学强度，而是因为
 * `Math.random()` 的输出是可以从几个样本反推后续值的。短码本身没有秘密，但
 * 「能预测下一个」就等于能在内容发布之前猜到它的地址。
 *
 * 不保证唯一 —— 唯一性由数据库的唯一索引保证，撞了就重来。1.7 万亿分之一的
 * 事不值得在这里查库。
 */
export function newShortCode(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** 形状对不对。路由拿它挡掉明显不是短码的请求，省一次查库。 */
export function looksLikeShortCode(value: string): boolean {
  if (value.length !== LENGTH) return false;
  for (const ch of value) if (!ALPHABET.includes(ch)) return false;
  return true;
}
