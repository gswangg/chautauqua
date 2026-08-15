// DEC-083 wave-26 amendment: a signed-in organiser must never see the
// public-cache staleness window their own change just opened. A request
// carrying a chq_session cookie skips both cache.match and cache.put in
// publicCacheMiddleware and always renders fresh; anonymous requests (no
// session cookie) and requests carrying some other, unrelated cookie both
// keep using the shared cache exactly as before.

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  CLIENT_CACHE_CONTROL,
  PUBLIC_VERSION_STALENESS_SECONDS,
  publicCacheMiddleware,
  type CacheLike,
} from "../src/server/pubcache";
import { SESSION_COOKIE_NAME } from "../src/auth/cookies";
import type { KVStore } from "../src/lib/draft";
import type { AppEnv } from "../src/server/env";

function fakeKv(initial: Record<string, string> = {}): KVStore & { store: Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    async get(key) {
      return key in store ? store[key]! : null;
    },
    async put(key, value) {
      store[key] = value;
    },
    async delete(key) {
      delete store[key];
    },
  };
}

function fakeCache(): CacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    async match(request) {
      return store.get(request.url);
    },
    async put(request, response) {
      store.set(request.url, response);
    },
  };
}

function buildApp(cache: CacheLike, kv: KVStore) {
  const app = new Hono<AppEnv>();
  app.use("*", publicCacheMiddleware(() => cache));
  let calls = 0;
  app.get("/e/:slug/sessions", (c) => {
    calls += 1;
    return c.text(`sessions-${calls}`, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
  });
  return { app, env: { KV: kv } as unknown as AppEnv["Bindings"], getCalls: () => calls };
}

describe("PUBLIC_VERSION_STALENESS_SECONDS", () => {
  it("is 60 (the documented Workers KV edge cacheTtl floor) — assert the bound cannot be silently edited", () => {
    expect(PUBLIC_VERSION_STALENESS_SECONDS).toBe(60);
  });
});

describe("publicCacheMiddleware: signed-in session cookie bypasses the public cache (DEC-083 wave-26 amendment)", () => {
  it("a GET carrying chq_session neither reads nor writes the cache and renders fresh every time", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    const first = await app.request("/e/foo/sessions", { headers: { cookie: `${SESSION_COOKIE_NAME}=abc123` } }, env);
    expect(await first.text()).toBe("sessions-1");
    expect(cache.store.size).toBe(0);

    const second = await app.request("/e/foo/sessions", { headers: { cookie: `${SESSION_COOKIE_NAME}=abc123` } }, env);
    expect(await second.text()).toBe("sessions-2"); // handler ran again — never served from cache
    expect(getCalls()).toBe(2);
    expect(cache.store.size).toBe(0); // never written either
  });

  it("the same GET without any cookie hits the cache exactly as today", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    const first = await app.request("/e/foo/sessions", {}, env);
    expect(await first.text()).toBe("sessions-1");
    expect(cache.store.size).toBe(1);

    const second = await app.request("/e/foo/sessions", {}, env);
    expect(await second.text()).toBe("sessions-1"); // served from cache
    expect(getCalls()).toBe(1);
    expect(second.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
  });

  it("a request carrying some OTHER cookie (e.g. chq_csrf, no session) still uses the cache", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    const first = await app.request("/e/foo/sessions", { headers: { cookie: "chq_csrf=zzz" } }, env);
    expect(await first.text()).toBe("sessions-1");
    expect(cache.store.size).toBe(1);

    const second = await app.request("/e/foo/sessions", { headers: { cookie: "chq_csrf=zzz" } }, env);
    expect(await second.text()).toBe("sessions-1"); // served from cache
    expect(getCalls()).toBe(1);
  });

  it("a cookie header containing both chq_csrf and chq_session still bypasses (session presence wins)", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    await app.request("/e/foo/sessions", { headers: { cookie: `chq_csrf=zzz; ${SESSION_COOKIE_NAME}=abc` } }, env);
    await app.request("/e/foo/sessions", { headers: { cookie: `chq_csrf=zzz; ${SESSION_COOKIE_NAME}=abc` } }, env);

    expect(getCalls()).toBe(2); // never cached
    expect(cache.store.size).toBe(0);
  });
});
