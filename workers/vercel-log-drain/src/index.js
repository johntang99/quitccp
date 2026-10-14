/**
 * Receives Vercel's log drain and files it in R2.
 *
 * Why this exists: Vercel keeps runtime logs for a day. After the attack of
 * 2026-10-13 the question we kept wanting to ask was "what exactly was arriving
 * at 03:40?", and by the time we thought to ask, the logs were gone. This keeps
 * them somewhere we control, for as long as we choose.
 *
 * It is deliberately dumb. It verifies the request really came from Vercel,
 * then writes the bytes it was given, unchanged, under a key you can find by
 * date. It does not parse, reshape, index or filter. Parsing is the caller's
 * job later; filtering is done at the drain, where it is free -- anything
 * dropped here would already have been paid for at $0.50/GB.
 *
 * Fidelity matters more than tidiness here: these are the records we will be
 * reading when something has gone wrong, and a transformation we got subtly
 * wrong at write time cannot be undone at read time.
 */

/** Vercel signs the body with HMAC-SHA1, hex, using the drain's secret. */
async function expectedSignature(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, body);
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compares without leaking where the two differ.
 *
 * Workers has no `timingSafeEqual`, and a plain `===` on a hex string returns
 * as soon as it finds a mismatched character. That difference is measurable
 * over enough requests, and this endpoint's URL is not a secret.
 */
function sameSignature(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * `logs/2026/10/14/09/1760432…-a1b2c3.ndjson`
 *
 * Partitioned by UTC hour because that is how the question gets asked -- "what
 * was happening around 09:30 on the 14th" -- and because it lets a lifecycle
 * rule expire whole prefixes. The random suffix keeps two batches that land in
 * the same millisecond from overwriting each other; R2 has no append.
 */
function objectKey(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}/${p(now.getUTCMonth() + 1)}/${p(now.getUTCDate())}/${p(now.getUTCHours())}`;
  const suffix = crypto.randomUUID().slice(0, 6);
  return `logs/${stamp}/${now.getTime()}-${suffix}.ndjson`;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      /* Vercel only ever POSTs. A GET is someone finding the URL, and the
         least interesting thing we can tell them is the most correct one. */
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.arrayBuffer();

    /*
     * The ownership handshake. Vercel tests the endpoint when the drain is
     * created, and that test carries `x-vercel-verify` rather than a
     * signature -- so it has to be answered before the signature check, or the
     * drain can never be created in the first place. It carries no log data.
     */
    const verify = request.headers.get("x-vercel-verify");
    if (verify) {
      return new Response("ok", { status: 200, headers: { "x-vercel-verify": verify } });
    }

    if (!env.DRAIN_SIGNATURE_SECRET) {
      /* Fail closed. Without the secret we cannot tell Vercel's data from
         anyone else's, and silently accepting both would poison the archive
         we are keeping precisely so it can be trusted later. */
      return new Response("drain secret not configured", { status: 500 });
    }

    const signature = request.headers.get("x-vercel-signature");
    const expected = await expectedSignature(env.DRAIN_SIGNATURE_SECRET, body);
    if (!sameSignature(signature ?? "", expected)) {
      return new Response("invalid signature", { status: 403 });
    }

    if (body.byteLength === 0) return new Response("ok", { status: 200 });

    /*
     * Written before we answer, not after. Vercel retries on a non-200, which
     * is the only thing standing between a transient R2 error and a hole in
     * the archive -- so the 200 has to mean "it is stored", not "it is queued".
     */
    try {
      await env.LOG_BUCKET.put(objectKey(), body, {
        httpMetadata: { contentType: "application/x-ndjson" }
      });
    } catch (error) {
      return new Response(`store failed: ${error?.message ?? error}`, { status: 500 });
    }

    return new Response("ok", { status: 200 });
  }
};
