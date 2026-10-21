import test from "node:test";
import assert from "node:assert/strict";
import { zh } from "./zh";
import { en } from "./en";

test("英文表没有缺项", () => {
  const missing = Object.keys(zh).filter((k) => !(k in en));
  assert.deepEqual(missing, [], `英文表缺：${missing.join(", ")}`);
});

test("英文表没有多出来的 key（多出来多半是拼错了）", () => {
  const extra = Object.keys(en).filter((k) => !(k in zh));
  assert.deepEqual(extra, [], `英文表多出：${extra.join(", ")}`);
});

test("两边的占位符一致", () => {
  /* "{site}" 这类占位符一边有一边没有，就是运行时少了一块文字或者多出一个
     没被替换的 {site}。两边都要对得上。 */
  const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(zh)) {
    if (!(key in en)) continue;
    assert.deepEqual(slots(en[key]), slots(zh[key]), `${key} 的占位符对不上`);
  }
});

test("英文表里没有残留的中文", () => {
  const bad = Object.entries(en).filter(([, v]) => /[一-鿿]/.test(v));
  assert.deepEqual(bad.map(([k]) => k), [], "英文表里还有中文");
});

test("没有空文案", () => {
  for (const [k, v] of Object.entries(zh)) assert.ok(v.trim(), `zh.${k} 是空的`);
  for (const [k, v] of Object.entries(en)) assert.ok(v.trim(), `en.${k} 是空的`);
});
