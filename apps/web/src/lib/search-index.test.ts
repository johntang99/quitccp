import test from "node:test";
import assert from "node:assert/strict";
import { staleSweepFilter } from "./search-index";

/**
 * 这几条测的是一个会删数据的过滤条件。
 *
 * 原来的条件没有语言限定，而四个站共用一个索引：英文站跑一次每周全量，就会把
 * 中文站那一万六千条文档全部删掉（它们的 synced_at 比英文站这次运行早）。
 * 搜索被清空，而且不报错 —— 直到一周后中文站自己的全量同步把它补回来。
 */

test("只删本站语言的文档", () => {
  const f = staleSweepFilter(["en"], 1000);
  assert.match(f, /locale = "en"/);
  /* 关键的一条：条件必须把语言和「过期」用 AND 连起来，
     少了这个 AND，过期条件就会作用到所有语言上。 */
  assert.match(f, /\) AND \(/);
  assert.ok(!f.includes('locale = "zh"'), "不该碰中文站的文档");
});

test("过期的两种情况都要认", () => {
  const f = staleSweepFilter(["zh"], 1234);
  assert.match(f, /synced_at < 1234/);
  /* 没有 synced_at 的文档是这个字段出现之前写进去的，
     只按时间比会把它们静默留下 —— 真有一条这样活过了一次全量同步。 */
  assert.match(f, /synced_at NOT EXISTS/);
});

test("多个语言展开成 OR，并且整体被括起来", () => {
  const f = staleSweepFilter(["zh", "en"], 7);
  assert.equal(f, '(locale = "zh" OR locale = "en") AND (synced_at < 7 OR synced_at NOT EXISTS)');
});

test("没给语言时不生成一个会删光全部的条件", () => {
  /* 空列表展开成空的 OR 段，`() AND (...)` 在 Meilisearch 上是语法错误 ——
     报错比静默删光好，但更该在这里就拦住。 */
  assert.throws(() => staleSweepFilter([], 1), /no locales/);
});
