import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES, LOCALE_LABELS } from "./site-config";

test("每种语言都有可读的名字", () => {
  for (const l of LOCALES) {
    assert.ok(LOCALE_LABELS[l], `${l} 缺名字`);
  }
});

test("语言代码没有重复", () => {
  assert.equal(new Set(LOCALES).size, LOCALES.length);
});
