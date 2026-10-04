/*
 * Only entities that cannot become markup.
 *
 * &lt; and &gt; are deliberately absent: 1,008 and 758 occurrences, and decoding
 * them would turn escaped text into live tags in content that is rendered as
 * markdown. &amp; is absent for the same reason -- decoding it first would turn
 * &amp;lt; into &lt; and hand the next pass something to decode into a tag.
 */
export const SAFE_ENTITIES = {
  '&ldquo;':'“', '&rdquo;':'”', '&lsquo;':'‘', '&rsquo;':'’',
  '&mdash;':'—', '&ndash;':'–', '&hellip;':'…', '&bull;':'·',
  '&times;':'×', '&sect;':'§', '&rarr;':'→', '&larr;':'←',
  '&quot;':'"', '&shy;':'', '&nbsp;':' ',
  '&#8211;':'–', '&#8212;':'—', '&#8216;':'‘', '&#8217;':'’',
  '&#8220;':'“', '&#8221;':'”', '&#8230;':'…',
  '&#8242;':'′', '&#8243;':'″', '&#215;':'×', '&#167;':'§', '&#183;':'·',
  // Numeric twins of the named forms above. &#8226; is U+2022 BULLET, but in
  // these texts it is always a Chinese title separator -- 《蝶恋花·答李淑一》 --
  // so it maps to the middle dot, matching what &bull; was given.
  '&#8226;':'·', '&#8249;':'‹', '&#8250;':'›', '&#8218;':'‚', '&#8222;':'„'
};

/*
 * CDATA wrappers left behind by the WordPress import.
 *
 * The opener appears in several shapes -- escaped or not, and with a comment
 * dash that may be a hyphen, an en dash, or an HTML entity for one. The entity
 * form matters: an earlier pass decoded &#8211; first and turned
 * &lt;!&#8211;[CDATA[ into &lt;!–[CDATA[, which the original patterns no longer
 * matched, so the cleanup left behind a marker it had itself reshaped.
 */
const CDATA = [
  /(?:<|&lt;)!\s*[-–—]*\s*\[CDATA\[/g,
  /\]\]\s*[-–—]*\s*(?:>|&gt;)/g
];

/*
 * Escaped angle brackets, which in these texts are always title marks.
 *
 * &lt;&lt;西游记&gt;&gt; is 《西游记》 and &lt;致词&gt; is 〈致词〉 -- the surrounding
 * prose already uses 《》 for books, so the escaped brackets are the inner level
 * Chinese writes as 〈〉. Readers were seeing the raw entities.
 *
 * Converting them to the real marks is also the safe way to resolve them:
 * decoding to < and > would hand a markdown renderer something to parse, which
 * is exactly why the earlier passes left these alone.
 */
function titleBrackets(text) {
  return text
    .replace(/&lt;&lt;([^<>&]{1,60}?)&gt;&gt;/g, '《$1》')
    .replace(/&lt;([^<>&]{1,60}?)&gt;/g, '〈$1〉');
}

export function clean(value) {
  if (typeof value !== 'string' || !value) return value;
  let out = value;
  out = titleBrackets(out);
  // &amp; last, and never where it would reconstitute another entity:
  // &amp;lt; must not become &lt; for a later pass to turn into a tag.
  out = out.replace(/&amp;(?!(?:[a-zA-Z][a-zA-Z0-9]{1,8}|#x?[0-9a-fA-F]+);)/g, '&');
  for (const [entity, char] of Object.entries(SAFE_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  for (const re of CDATA) out = out.replace(re, '');
  return out;
}
