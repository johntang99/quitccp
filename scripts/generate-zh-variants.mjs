import OpenCC from 'opencc-js';
import fs from 'node:fs';

const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });

// Walk the CJK Unified Ideographs block one character at a time. Character-level
// rather than phrase-level on purpose: a search wants every form a word might be
// written in, not the single reading OpenCC judges best in context.
const T2S = {};
const S2T = {};
let scanned = 0;
for (let cp = 0x4e00; cp <= 0x9fff; cp++) {
  const ch = String.fromCodePoint(cp);
  scanned++;
  const s = t2s(ch);
  if (s !== ch && s.length === 1) T2S[ch] = s;
  const t = s2t(ch);
  if (t !== ch && t.length === 1) S2T[ch] = t;
}
// Common extension-A characters appear in older texts.
for (let cp = 0x3400; cp <= 0x4dbf; cp++) {
  const ch = String.fromCodePoint(cp);
  scanned++;
  const s = t2s(ch);
  if (s !== ch && s.length === 1) T2S[ch] = s;
}

const out = `/**
 * Traditional <-> simplified character pairs, generated, do not edit by hand.
 *
 * Regenerate with scripts/generate-zh-variants.mjs (needs the opencc-js dev
 * dependency). The table is committed so nothing heavy ships: opencc-js unpacks
 * to 6MB, which has no business inside a serverless function that converts a
 * handful of characters per search.
 *
 * Character-level, not phrase-level. OpenCC normally converts in context to pick
 * the best reading; a search wants the opposite -- every form a word might have
 * been written in, so that 退黨 and 退党 find each other.
 *
 * Generated from ${scanned.toLocaleString()} code points: ${Object.keys(T2S).length} traditional -> simplified,
 * ${Object.keys(S2T).length} simplified -> traditional.
 */

export const TRADITIONAL_TO_SIMPLIFIED: Readonly<Record<string, string>> = ${JSON.stringify(T2S)};

export const SIMPLIFIED_TO_TRADITIONAL: Readonly<Record<string, string>> = ${JSON.stringify(S2T)};
`;
fs.writeFileSync('apps/web/src/lib/zh-variants.ts', out);
console.log(`  scanned ${scanned} code points`);
console.log(`  T->S pairs: ${Object.keys(T2S).length}`);
console.log(`  S->T pairs: ${Object.keys(S2T).length}`);
console.log(`  file size : ${(Buffer.byteLength(out)/1024).toFixed(0)} KB`);
