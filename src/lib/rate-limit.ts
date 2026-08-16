// DEC-038: originally the canonical scoped KV rate limiter used by auth
// endpoints (login, claim) and public submit (scope 'submit', DEC-057). This
// module stays pure (DEC-002) but DEC-948 moved the actual counter (the four
// KVStore-taking functions: checkAndIncrementScopedLimit, peekScopedLimit,
// incrementScopedLimit, resetScopedLimit) to src/server/repo/rate-limit.ts,
// where an atomic D1 upsert replaces the KV get-then-put race (N concurrent
// callers against KV can all read count=0 and all pass). What remains here
// is pure key/id derivation shared by both the deleted KV path's history and
// the current D1 repo: boundRateLimitId, scopedRateLimitKey (the repo builds
// its `key` column from this, so live bucket identity is unchanged) and
// requestIpFromHeaders.

// DEC-457: KV keys must never carry unbounded external input directly — a
// caller-supplied id (email, x-forwarded-for) can be arbitrarily long, and
// Cloudflare KV rejects keys over 512 UTF-8 bytes. boundRateLimitId caps the
// id portion of the key at MAX_RATE_LIMIT_ID_BYTES, leaving every real
// email/IP (well under the cap) byte-for-byte unchanged so no live counter
// bucket shifts, while an oversized id is deterministically collapsed to a
// short hash-derived token instead of ever reaching KV unbounded.
export const MAX_RATE_LIMIT_ID_BYTES = 128;

/** Pure FNV-1a-32 hash (no crypto.subtle — sync, dependency-free, DEC-002). */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function boundRateLimitId(id: string): string {
  const byteLen = new TextEncoder().encode(id).length;
  if (byteLen <= MAX_RATE_LIMIT_ID_BYTES) return id;
  const hex8 = fnv1a32(id).toString(16).padStart(8, "0");
  return `x${hex8}-${byteLen}`;
}

export function scopedRateLimitKey(scope: string, id: string, windowStartMs: number): string {
  return `ratelimit:${scope}:${boundRateLimitId(id)}:${windowStartMs}`;
}

/** Mirrors the IP-resolution logic in src/routes/public/submit.tsx.
 *
 * DEC-072 (wave-67 amendment): the ONE statement of this property. There
 * are exactly three branches, and only one of them collapses to a shared
 * bucket:
 *
 *   1. cf-connecting-ip present -> that value, verbatim. Trustworthy ONLY
 *      when the request has actually passed through Cloudflare's edge
 *      (stage 2 deployment); nothing upstream of this function currently
 *      guarantees that in stage 1 / wrangler dev.
 *   2. cf-connecting-ip absent, x-forwarded-for present -> the first hop
 *      of x-forwarded-for, trimmed, VERBATIM. This is CLIENT-CONTROLLED:
 *      an attacker can send an arbitrary value and rotate it per request.
 *      It does NOT collapse to one shared bucket — it produces one
 *      distinct bucket PER DISTINCT VALUE, so rotating the header buys a
 *      fresh budget on any front door that is not Cloudflare's edge.
 *   3. both absent -> the literal string "unknown". This is the only
 *      branch that is a genuinely shared bucket, and only an ABSENT
 *      header reaches it.
 *
 * Because branch 2 is attacker-controlled and NOT a shared bucket, an
 * IP-keyed budget built on this function cannot be safely refunded on
 * failure (refunding would let an attacker probe the true state of a
 * bucket it can already rotate away from) and cannot by itself provide
 * real correctness — every caller that needs real correctness (e.g.
 * login, submit) MUST also key a SECOND, independent scoped limiter on a
 * stable identity value the attacker does not control (the submitted
 * account email — see submit-post.tsx's "submit-email" scope and
 * auth-helpers.ts's login-account email-only bucket), rather than relying
 * on IP alone. */
export function requestIpFromHeaders(header: (name: string) => string | undefined): string {
  const cfIp = header("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwardedFor = header("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}
