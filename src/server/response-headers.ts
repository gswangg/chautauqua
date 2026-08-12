// DEC-697: a response a middleware did not construct itself (workerd
// ASSETS responses, cached responses replayed via caches.default, etc.)
// may carry an IMMUTABLE Headers object -- Headers.set/append/delete
// throws a TypeError on it. Every post-next() middleware that decorates
// `c.res` with extra headers goes through this ONE helper rather than
// calling `c.res.headers.set(...)` directly, so the immutable-headers
// hazard is handled in exactly one place.

import type { Context } from "hono";
import type { AppEnv } from "./env";
import { DEC_697 } from "../decisions";

void DEC_697;

/** Reads a header off the current response without risking a mutation
 * (`.has()` never throws, even on an immutable Headers object). */
export function responseHasHeader(c: Context<AppEnv>, name: string): boolean {
  return c.res.headers.has(name);
}

/** Applies every [name, value] pair to `c.res`. Tries the in-place
 * mutation first (the common case -- most responses, including every one
 * a route handler builds with `c.text`/`c.json`/`new Response(...)`, have
 * ordinary editable Headers). If that throws a TypeError (immutable
 * Headers), rebuilds the response as `new Response(c.res.body, c.res)` --
 * which copies status, statusText and the existing (still-frozen-origin
 * but now-fresh-and-editable) headers onto a brand-new Response -- applies
 * every entry to the clone's Headers, and assigns the clone back onto
 * `c.res` so downstream middleware/the caller see the decorated response.
 * Any other error is not this function's concern and propagates. */
export function setResponseHeaders(c: Context<AppEnv>, entries: readonly (readonly [string, string])[]): void {
  try {
    for (const [name, value] of entries) {
      c.res.headers.set(name, value);
    }
    return;
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  const original = c.res;
  const rebuilt = new Response(original.body, original);
  for (const [name, value] of entries) {
    rebuilt.headers.set(name, value);
  }
  c.res = rebuilt;
}
