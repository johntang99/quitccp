import test from "node:test";
import assert from "node:assert/strict";
import { formatNumber } from "./format";

test("千分位按语言", () => {
  assert.equal(formatNumber(1234567, "en-US"), "1,234,567");
  assert.equal(formatNumber(1234567, "de-DE"), "1.234.567");
  assert.equal(formatNumber(1234567, "zh-CN"), "1,234,567");
});

test("零和负数", () => {
  assert.equal(formatNumber(0, "en-US"), "0");
  assert.equal(formatNumber(-5, "de-DE"), "-5");
});
