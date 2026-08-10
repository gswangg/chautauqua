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

/** Mirrors the IP-resolution logic in src/routes/public/submit.tsx:
 * cf-connecting-ip, else the first hop of x-forwarded-for, else 'unknown'. */
export function requestIpFromHeaders(header: (name: string) => string | undefined): string {
  const cfIp = header("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwardedFor = header("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}
