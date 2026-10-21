import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES, LOCALE_LABELS, pickLocale } from "./site-config";

test("每种语言都有可读的名字", () => {
  for (const l of LOCALES) {
    assert.ok(LOCALE_LABELS[l], `${l} 缺名字`);
  }
});

test("语言代码没有重复", () => {
  assert.equal(new Set(LOCALES).size, LOCALES.length);
});

test("没配 SITE_LOCALE 就是中文站，而且不该报警", () => {
  /* 这条是因为真出过噪音：next.config 为了让客户端包也拿到这个值，未配置时
     传的是空字符串，而判断原来把空字符串当「配错了」，于是中文站每个请求都
     警告一次。一个每次都响的警报等于没有警报。 */
  for (const value of [undefined, null, "", "   "]) {
    const { locale, warn } = pickLocale(value);
    assert.equal(locale, "zh");
    assert.equal(warn, null, `${JSON.stringify(value)} 不该产生警告`);
  }
});

test("配对了就用，大小写和空格不计", () => {
  for (const [raw, want] of [["en", "en"], ["EN", "en"], [" de ", "de"], ["ja", "ja"]] as const) {
    const { locale, warn } = pickLocale(raw);
    assert.equal(locale, want);
    assert.equal(warn, null);
  }
});

test("配错了退回中文并喊一声，而不是让整站起不来", () => {
  const { locale, warn } = pickLocale("klingon");
  assert.equal(locale, "zh");
  assert.match(String(warn), /klingon/);
});
