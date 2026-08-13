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

/** Mirrors the IP-resolution logic in src/routes/public/submit.tsx:
 * cf-connecting-ip, else the first hop of x-forwarded-for, else 'unknown'.
 *
 * DEC-072: x-forwarded-for is client-controllable and trivially spoofable
 * (an attacker can send an arbitrary rotating value) — it is only a
 * best-effort fallback for local/stage-1 dev where no trusted edge sets
 * cf-connecting-ip. cf-connecting-ip is authoritative only when the
 * request has actually passed through Cloudflare's edge (stage 2
 * deployment); nothing upstream of this function currently guarantees
 * that. Because IP is not a trustworthy identity, callers that need real
 * correctness (e.g. login) MUST also key a scoped limiter by a stable
 * identity value (such as the submitted account email) rather than
 * relying on IP alone. */
export function requestIpFromHeaders(header: (name: string) => string | undefined): string {
  const cfIp = header("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwardedFor = header("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}
