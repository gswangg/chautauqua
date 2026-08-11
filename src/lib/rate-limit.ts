// DEC-038: the canonical scoped KV rate limiter used by auth endpoints
// (login, claim). DEC-057 supersedes DEC-038's original freeze note: public
// submit (src/routes/public/submit.tsx) now also uses this limiter directly
// (scope 'submit') — the legacy checkAndIncrementRateLimit in
// src/lib/submit-core.ts has been deleted. Pure Web APIs + the plain
// KVStore interface only (DEC-002) — no node:/cloudflare imports.

import type { KVStore } from "./draft";

export function scopedRateLimitKey(scope: string, id: string, windowStartMs: number): string {
  return `ratelimit:${scope}:${id}:${windowStartMs}`;
}

export interface ScopedRateLimitResult {
  ok: boolean;
  count: number;
}

/** Fixed-window per-scope-and-id KV counter. Fails loudly by rejecting once
 * the cap is hit — never silently drops the count or allows overflow. */
export async function checkAndIncrementScopedLimit(
  kv: KVStore,
  scope: string,
  id: string,
  now: number,
  opts: { windowSeconds: number; max: number },
): Promise<ScopedRateLimitResult> {
  const { windowSeconds, max } = opts;
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = scopedRateLimitKey(scope, id, windowStart);
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  if (count >= max) {
    return { ok: false, count };
  }
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return { ok: true, count: count + 1 };
}

// DEC-180: login rate limiting must count only failures, not every attempt
// (a successful login should not consume the shared budget, and a success
// should reset the per-identity budget). These three helpers split the
// check-and-increment behavior of checkAndIncrementScopedLimit into
// independent read / write / reset primitives so callers can decide when
// (and whether) to record an attempt.

/** Read-only peek at the current window's count. Never writes to KV. */
export async function peekScopedLimit(
  kv: KVStore,
  scope: string,
  id: string,
  now: number,
  opts: { windowSeconds: number; max: number },
): Promise<ScopedRateLimitResult> {
  const { windowSeconds, max } = opts;
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = scopedRateLimitKey(scope, id, windowStart);
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  return { ok: count < max, count };
}

/** Unconditionally increments the current window's counter by one. */
export async function incrementScopedLimit(
  kv: KVStore,
  scope: string,
  id: string,
  now: number,
  opts: { windowSeconds: number; max: number },
): Promise<void> {
  const { windowSeconds } = opts;
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = scopedRateLimitKey(scope, id, windowStart);
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
}

/** Deletes the current window's counter key, clearing the budget. */
export async function resetScopedLimit(
  kv: KVStore,
  scope: string,
  id: string,
  now: number,
  windowSeconds: number,
): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = scopedRateLimitKey(scope, id, windowStart);
  await kv.delete(key);
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
