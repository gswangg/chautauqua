// J10 / DEC-083: real purge-on-publish edge caching for public surfaces.
// Supersedes DEC-022's "no purge machinery" sentence (client-facing
// Cache-Control stays DEC-022's max-age=60 + stale-while-revalidate=300;
// setCacheHeaders in src/routes/public.tsx is unchanged). The stored copy
// in caches.default carries a long max-age because purge is a version
// swap, not a TTL wait: bumpPublicVersionMiddleware writes a fresh random
// token to KV after any successful (status < 400) non-GET/HEAD/OPTIONS
// request, and publicCacheMiddleware folds that version into the cache
// key so a purge is just "the old key is never looked up again" (O(1),
// no URL enumeration, no lost-update window from concurrent counters).
//
// DEC-099: the internal 86400 max-age on the stored copy must never reach
// clients/proxies. On a cache hit, servePublicGet rebuilds the Response
// with Cache-Control overwritten back to CLIENT_CACHE_CONTROL (byte-
// identical to setCacheHeaders's header value in src/routes/public.tsx,
// not imported from there since that module isn't pure-core) before
// returning it — the cached Response's headers are immutable, so a fresh
// Response wrapping the same body is required.
//
// Written against CacheLike + the KVStore interface from src/lib/draft.ts
// (DEC-002 pure-core convention) so the core logic unit-tests with fakes,
// no real Cache API / KVNamespace required.
//
// DEC-442: the ics skip is request-shaped, not path-shaped. Bare
// schedule.ics (no ?ids=) does identical work to agenda.ics, so it now
// joins the same version-salted cache key space and gets purged by the
// same bumpPublicVersionMiddleware swap. Only a schedule.ics request that
// carries an `ids` query string (even empty — per-user/unbounded
// cardinality) stays excluded; see isUncacheableIcsRequest.

import type { Context, Next } from "hono";
import type { AppEnv } from "./env";
import type { KVStore } from "../lib/draft";

export const PUBVER_KEY = "chq:pubver";

/** @cloudflare/workers-types doesn't declare `caches.default` (it's a
 * documented Workers runtime API, just untyped) — this is the one place
 * that casts to reach it, so callers get a properly-typed CacheLike. */
export function defaultCache(): CacheLike {
  return (caches as unknown as { default: CacheLike }).default;
}

/** Structural subset of the Cache API (caches.default) — small enough to fake. */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

const ABSENT_VERSION = "v0";
const CLIENT_CACHE_CONTROL_OVERRIDE = "public, max-age=86400";

/** DEC-099: client-facing Cache-Control for cache-hit responses. Must stay
 * byte-identical to setCacheHeaders's header value in src/routes/public.tsx
 * (line ~61) — that module is not pure-core so it isn't imported here. */
export const CLIENT_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

/** Reads the current public version, defaulting to 'v0' when the key is
 * simply absent (a fresh KV namespace pre-first-mutation). A missing KV
 * *binding* is a caller bug and is not handled here — fail loudly. */
export async function readPublicVersion(kv: KVStore): Promise<string> {
  const raw = await kv.get(PUBVER_KEY);
  return raw ?? ABSENT_VERSION;
}

/** Builds the version-salted cache key for a given request URL. */
export function versionedCacheKey(url: string, version: string): Request {
  const keyed = new URL(url);
  keyed.searchParams.set("__chqv", version);
  return new Request(keyed.toString());
}

/** DEC-442: request-shaped (not path-shaped) skip. Only a schedule.ics
 * request carrying an `ids` query string (even empty) is per-user/
 * unbounded-cardinality and must bypass the cache; the bare whole-agenda
 * schedule.ics does identical work to agenda.ics and joins the same
 * version-salted cache as everything else. */
export function isUncacheableIcsRequest(url: string): boolean {
  const parsed = new URL(url);
  return parsed.pathname.endsWith("/schedule.ics") && parsed.searchParams.has("ids");
}

/** Core GET-path logic, pure against CacheLike + KVStore, so it's callable
 * both from the Hono middleware and directly from unit tests. */
export async function servePublicGet(
  cache: CacheLike,
  kv: KVStore,
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const version = await readPublicVersion(kv);
  const cacheKey = versionedCacheKey(request.url, version);

  const hit = await cache.match(cacheKey);
  if (hit) {
    // Cached Response headers are immutable, so build a fresh Response
    // wrapping the same body and restore the client-facing Cache-Control
    // (the stored copy carries the internal 86400 override).
    const restored = new Response(hit.body, hit);
    restored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL);
    return restored;
  }

  const response = await next();
  if (response.status === 200) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL_OVERRIDE);
    await cache.put(cacheKey, stored);
  }
  return response;
}

/** After any successful (status < 400) non-GET/HEAD/OPTIONS request, bump
 * the public version to a fresh random token — never a counter, per
 * DEC-083 (race-proof: no lost-update window from concurrent bumps). */
export async function bumpIfMutating(kv: KVStore, method: string, status: number): Promise<void> {
  const upper = method.toUpperCase();
  if (upper === "GET" || upper === "HEAD" || upper === "OPTIONS") return;
  if (status >= 400) return;
  await kv.put(PUBVER_KEY, crypto.randomUUID());
}

/** Hono middleware: GET-only, version-salted caches.default read-through
 * for public/embed HTML and the bare whole-agenda schedule.ics (DEC-442).
 * Skips only schedule.ics requests carrying an `ids` query string
 * (per-user selections would pollute the cache; DEC-083/DEC-442). Missing
 * KV/caches.default binding throws — fail loudly, no silent fallback to
 * uncached serving.
 *
 * `cache` is a thunk (not a resolved CacheLike) so module-level middleware
 * registration never touches the `caches` global at import time — it's a
 * real Workers-runtime global, but absent under vitest's node test
 * environment, and route sub-app modules must stay importable there. */
export function publicCacheMiddleware(cache: () => CacheLike) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.req.method !== "GET" || isUncacheableIcsRequest(c.req.url)) {
      await next();
      return;
    }
    if (!c.env.KV) throw new Error("publicCacheMiddleware requires the KV binding");
    const kv: KVStore = c.env.KV;
    const response = await servePublicGet(cache(), kv, c.req.raw, async () => {
      await next();
      return c.res;
    });
    c.res = response;
  };
}

/** Registered once in createBaseApp (DEC-083), ahead of every route sub-app
 * mount, so any successful mutating request anywhere in the app bumps the
 * public cache version.
 *
 * DEC-427: a missing KV *binding* is a configuration bug (a violated
 * internal invariant) and still throws — fail loudly. But the KV *write*
 * itself runs after the handler's mutation has already committed, so a
 * rejection from that write is IO failure at an external boundary: it is
 * caught and logged loudly (console.error, naming PUBVER_KEY and the
 * error) rather than propagated, and the response keeps whatever status
 * the handler produced. Failing the request here would turn a successful,
 * already-committed write into a false failure for the caller. */
export async function bumpPublicVersionMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  await next();
  if (!c.env.KV) throw new Error("bumpPublicVersionMiddleware requires the KV binding");
  try {
    await bumpIfMutating(c.env.KV, c.req.method, c.res.status);
  } catch (err) {
    console.error(`bumpPublicVersionMiddleware: failed to bump ${PUBVER_KEY}`, err);
  }
}
