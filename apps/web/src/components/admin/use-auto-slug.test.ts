import test from "node:test";
import assert from "node:assert/strict";
import { retargetSlugDate } from "./use-auto-slug";

test("换掉日期段，主体不动", () => {
  assert.equal(
    retargetSlugDate("2026-10-21-san-tui-hong-sheng-di-78-ji", "2026-10-20T22:17:00Z"),
    "2026-10-20-san-tui-hong-sheng-di-78-ji"
  );
});

test("手工改过的主体也保住", () => {
  assert.equal(
    retargetSlugDate("2026-10-21-wo-zi-ji-xie-de", "2026-05-21T10:00:00Z"),
    "2026-05-21-wo-zi-ji-xie-de"
  );
});

test("日期一样就原样返回同一个字符串", () => {
  const s = "2026-10-20-abc";
  assert.equal(retargetSlugDate(s, "2026-10-20T22:17:00Z"), s);
});

test("没有日期前缀的地址不动", () => {
  assert.equal(retargetSlugDate("santui-shoujupai-2jiantao", "2026-10-20T00:00:00Z"), "santui-shoujupai-2jiantao");
});

test("看起来像日期但后面没东西的不动", () => {
  assert.equal(retargetSlugDate("2026-10-21", "2026-10-20T00:00:00Z"), "2026-10-21");
});

test("发布时间非法就不动", () => {
  assert.equal(retargetSlugDate("2026-10-21-abc", "不是日期"), "2026-10-21-abc");
});

test("按 UTC 取日，和服务端一致", () => {
  /* 10-20 22:17Z 在 UTC+8 已经是 10-21，但前缀必须是 UTC 的 10-20。 */
  assert.equal(retargetSlugDate("2000-01-01-abc", "2026-10-20T22:17:00Z"), "2026-10-20-abc");
});
