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
// Written against CacheLike + the KVStore interface from src/lib/draft.ts
// (DEC-002 pure-core convention) so the core logic unit-tests with fakes,
// no real Cache API / KVNamespace required.

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

export function isIcsPath(path: string): boolean {
  return path.endsWith("/schedule.ics");
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
  if (hit) return hit;

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
 * for public/embed HTML. Skips schedule.ics (per-user ?ids= query strings
 * would pollute the cache; DEC-083). Missing KV/caches.default binding
 * throws — fail loudly, no silent fallback to uncached serving.
 *
 * `cache` is a thunk (not a resolved CacheLike) so module-level middleware
 * registration never touches the `caches` global at import time — it's a
 * real Workers-runtime global, but absent under vitest's node test
 * environment, and route sub-app modules must stay importable there. */
export function publicCacheMiddleware(cache: () => CacheLike) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.req.method !== "GET" || isIcsPath(new URL(c.req.url).pathname)) {
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
 * public cache version. */
export async function bumpPublicVersionMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  await next();
  if (!c.env.KV) throw new Error("bumpPublicVersionMiddleware requires the KV binding");
  await bumpIfMutating(c.env.KV, c.req.method, c.res.status);
}
