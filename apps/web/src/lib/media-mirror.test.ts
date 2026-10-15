import { test } from "node:test";
import assert from "node:assert/strict";
import { mirrorRewrite, rewriteMediaText, rewriteMediaUrl } from "./media-mirror";

/* A fixed rule, so the tests say what they mean rather than depending on
   whatever happens to be in the environment that runs them. */
const RULE = {
  from: "//sukwifqplsyhbwmlfuti.supabase.co/storage/v1/object/public/media/",
  to: "//media.tdinfo.org/"
};

const supa = (key: string) => `https://sukwifqplsyhbwmlfuti.supabase.co/storage/v1/object/public/media/${key}`;
const mirror = (key: string) => `https://media.tdinfo.org/${key}`;

test("rewrites a stored image URL", () => {
  assert.equal(rewriteMediaUrl(supa("articles/00/abc.jpg"), RULE), mirror("articles/00/abc.jpg"));
});

test("keeps the query string — the profile PDF relies on ?download=", () => {
  const key = "press/quitccp-org-profile.pdf?download=%E7%AE%80%E4%BB%8B.pdf";
  assert.equal(rewriteMediaUrl(supa(key), RULE), mirror(key));
});

test("leaves other hosts alone", () => {
  for (const url of [
    "https://i.epochtimes.com/assets/uploads/2026/01/a.jpg",
    "https://www.youtube.com/watch?v=abc",
    "https://www.ganjingworld.com/video/x",
    "https://www.tuidang.org/news/foo"
  ]) assert.equal(rewriteMediaUrl(url, RULE), url, url);
});

test("leaves signed URLs alone — they are per-object and meaningless on the mirror", () => {
  const signed = "https://sukwifqplsyhbwmlfuti.supabase.co/storage/v1/object/sign/media/a.jpg?token=xyz";
  assert.equal(rewriteMediaUrl(signed, RULE), signed);
});

test("is idempotent — a URL already on the mirror is untouched", () => {
  const once = rewriteMediaUrl(supa("a.jpg"), RULE);
  assert.equal(rewriteMediaUrl(once, RULE), once);
});

test("passes null and undefined through", () => {
  assert.equal(rewriteMediaUrl(null, RULE), null);
  assert.equal(rewriteMediaUrl(undefined, RULE), undefined);
});

test("rewrites every occurrence inside a markdown body", () => {
  const body = `前文 ![a](${supa("x/1.jpg")}) 中间 ![b](${supa("x/2.png")}) 还有 https://i.epochtimes.com/z.jpg 结尾`;
  const out = rewriteMediaText(body, RULE);
  assert.equal(out.includes("supabase.co"), false);
  assert.equal((out.match(/media\.tdinfo\.org/g) ?? []).length, 2);
  assert.ok(out.includes("i.epochtimes.com/z.jpg"), "外站地址必须保留");
});

test("handles JSON-escaped slashes", () => {
  const json = JSON.stringify({ hero: supa("a.jpg") }).replace(/\//g, "\\/");
  const out = rewriteMediaText(json, RULE);
  assert.equal(out.includes("supabase.co"), false);
  assert.ok(out.includes("media.tdinfo.org".replace(/\//g, "\\/")) || out.includes("media.tdinfo.org"));
});

test("does nothing when no mirror host is configured", () => {
  const before = process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST;
  delete process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST;
  try {
    assert.equal(mirrorRewrite(), null);
    assert.equal(rewriteMediaUrl(supa("a.jpg")), supa("a.jpg"));
    assert.equal(rewriteMediaText(`x ${supa("a.jpg")} y`), `x ${supa("a.jpg")} y`);
  } finally {
    if (before !== undefined) process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST = before;
  }
});

test("builds the rule from the environment", () => {
  const saved = { ...process.env };
  process.env.NEXT_PUBLIC_MEDIA_MIRROR_HOST = "https://media.tdinfo.org/";
  process.env.SUPABASE_URL = "https://sukwifqplsyhbwmlfuti.supabase.co";
  process.env.SUPABASE_STORAGE_BUCKET = "media";
  try {
    assert.deepEqual(mirrorRewrite(), RULE, "尾斜杠和协议前缀都应被规整掉");
  } finally {
    process.env = saved;
  }
});
