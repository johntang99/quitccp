import test from "node:test";
import assert from "node:assert/strict";
import { synonymsOf } from "./search-synonyms";
import { SITE_LOCALE } from "./site-config";

test("中文站展开同义词，其余语言不展开", () => {
  const got = synonymsOf("退党");
  if (SITE_LOCALE === "zh") {
    assert.ok(got.includes("三退"), "中文站应该把 退党 展开到 三退");
    assert.ok(got.length > 1);
  } else {
    assert.deepEqual(got, ["退党"], "非中文站不该展开中文同义词");
  }
});

test("表里没有的词原样返回", () => {
  assert.deepEqual(synonymsOf("zzz-not-in-table"), ["zzz-not-in-table"]);
});
