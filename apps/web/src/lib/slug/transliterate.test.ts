import test from "node:test";
import assert from "node:assert/strict";
import { transliterate, latinSlugify, pinyinTransliterate, titleToken, hasTransliterator } from "./transliterate";

test("中文走拼音，词组读对", () => {
  assert.equal(pinyinTransliterate("重庆银行"), "chong-qing-yin-hang");
  assert.equal(pinyinTransliterate("是什么"), "shi-shen-me");
});

test("繁简同一个地址", () => {
  assert.equal(pinyinTransliterate("首鋼煉鋼廠"), pinyinTransliterate("首钢炼钢厂"));
});

test("英文直接 slugify", () => {
  assert.equal(transliterate("Why Quit the CCP?", "en"), "why-quit-the-ccp");
});

test("德文变音符用约定拼法，不是剥掉", () => {
  assert.equal(transliterate("Grüße aus Köln", "de"), "gruesse-aus-koeln");
  assert.equal(transliterate("Straße", "de"), "strasse");
  /* 剥掉附标会得到 gruse / strase —— 是别的词。 */
  assert.notEqual(transliterate("Grüße", "de"), "gruse");
});

test("罗马尼亚文去附标", () => {
  assert.equal(transliterate("Știri despre București", "ro"), "stiri-despre-bucuresti");
});

test("日文、韩文没登记转写器，走短记号", () => {
  assert.equal(hasTransliterator("ja"), false);
  assert.equal(hasTransliterator("ko"), false);
  const ja = transliterate("中国共産党からの脱退", "ja");
  assert.match(ja, /^[0-9A-Za-z]{7}$/);
});

test("短记号是确定性的：同样的标题永远同一个", () => {
  const a = titleToken("中国共産党からの脱退");
  const b = titleToken("中国共産党からの脱退");
  assert.equal(a, b);
  assert.notEqual(a, titleToken("别的标题"));
});

test("转写器产出为空也走短记号，不会返回空串", () => {
  /* 只有标点的标题，拼音和 slugify 都会得到空。 */
  const out = transliterate("！！！", "zh");
  assert.match(out, /^[0-9A-Za-z]{7}$/);
});

test("没登记的语言不报错", () => {
  assert.match(transliterate("Some title", "th"), /^[0-9A-Za-z]{7}$/);
});

test("NFD 拆不开的拉丁字母有兜底，不会被当成标点丢掉", () => {
  /* ß、ø、æ、ł 都不是「基本字母 + 附标」，NFD 拆不动它们。
     英文站上 ü 走通用的去附标（→u），ß 走兜底表（→ss）。 */
  assert.equal(transliterate("Grüße aus Köln", "en"), "grusse-aus-koln");
  assert.equal(transliterate("Smørrebrød", "en"), "smorrebrod");
  assert.equal(transliterate("Encyclopædia", "en"), "encyclopaedia");
  assert.equal(transliterate("Łódź", "en"), "lodz");
});

test("德文站仍然用德语的约定拼法，不是通用兜底", () => {
  /* 通用兜底给 ü→u，德语约定给 ü→ue。德文站要后者。 */
  assert.equal(transliterate("Grüße aus Köln", "de"), "gruesse-aus-koeln");
  assert.equal(transliterate("Grüße aus Köln", "en"), "grusse-aus-koln");
});
