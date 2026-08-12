// DEC-083: purge-on-publish edge caching. Core logic is pure against
// CacheLike + KVStore (src/lib/draft.ts), so it unit-tests with fakes —
// no real Cache API / KVNamespace required.

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_CACHE_CONTROL,
  PUBVER_KEY,
  bumpIfMutating,
  bumpPublicVersionMiddleware,
  isUncacheableIcsRequest,
  publicCacheMiddleware,
  readPublicVersion,
  servePublicGet,
  versionedCacheKey,
  type CacheLike,
} from "../src/server/pubcache";
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

/** DEC-427: a variant fake KV whose `put` always rejects, modeling a KV
 * write failure at the external IO boundary — the passing `fakeKv` above is
 * left untouched; this is a separate model. */
function throwingPutKv(): KVStore & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    async get(key) {
      return key in store ? store[key]! : null;
    },
    async put() {
      throw new Error("KV put failed (simulated)");
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

describe("readPublicVersion", () => {
  it("defaults to v0 when the key is absent", async () => {
    expect(await readPublicVersion(fakeKv())).toBe("v0");
  });

  it("returns the stored version", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "abc-123" });
    expect(await readPublicVersion(kv)).toBe("abc-123");
  });
});

describe("versionedCacheKey", () => {
  it("appends __chqv to the URL", () => {
    const req = versionedCacheKey("https://x.test/e/foo/sessions", "v7");
    expect(req.url).toBe("https://x.test/e/foo/sessions?__chqv=v7");
  });
});

describe("isUncacheableIcsRequest", () => {
  it("is true only for schedule.ics requests carrying ?ids=", () => {
    expect(isUncacheableIcsRequest("https://x.test/e/foo/schedule.ics?ids=a,b")).toBe(true);
    expect(isUncacheableIcsRequest("https://x.test/e/foo/schedule.ics")).toBe(false);
    expect(isUncacheableIcsRequest("https://x.test/e/foo/sessions")).toBe(false);
    expect(isUncacheableIcsRequest("https://x.test/e/foo/agenda.ics")).toBe(false);
  });

  it("even an empty ids value still counts as per-user (stays uncacheable)", () => {
    expect(isUncacheableIcsRequest("https://x.test/e/foo/schedule.ics?ids=")).toBe(true);
  });
});

describe("servePublicGet", () => {
  it("is a miss the first time, then a hit on the same version", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    let calls = 0;
    const next = async () => {
      calls += 1;
      return new Response("hello", { status: 200, headers: { "Cache-Control": "public, max-age=60" } });
    };

    const first = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    expect(await first.text()).toBe("hello");
    expect(calls).toBe(1);

    const second = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    expect(await second.text()).toBe("hello");
    expect(calls).toBe(1); // served from cache, next() not called again
  });

  it("overrides the stored response's Cache-Control to a long max-age", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () => new Response("ok", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });

    await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("DEC-099: a hit is re-served with the client-facing Cache-Control, not the stored 86400 override", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () =>
      new Response("hello", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });

    const req = () => new Request("https://x.test/e/foo/sessions");
    const miss = await servePublicGet(cache, kv, req(), next);
    expect(miss.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=300");

    const hit = await servePublicGet(cache, kv, req(), next);
    expect(await hit.text()).toBe("hello");
    expect(hit.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);

    // the copy inside the cache itself is untouched — still the internal 86400 override
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("does not cache non-200 responses", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () => new Response("not found", { status: 404 });

    await servePublicGet(cache, kv, new Request("https://x.test/e/missing/sessions"), next);
    expect(cache.store.size).toBe(0);
  });

  it("a version bump invalidates a previously-cached key (new cache entry, next() called again)", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    let calls = 0;
    const next = async () => {
      calls += 1;
      return new Response(`body-${calls}`, { status: 200 });
    };

    const req = () => new Request("https://x.test/e/foo/sessions");
    await servePublicGet(cache, kv, req(), next);
    expect(calls).toBe(1);

    // still a hit before any bump
    await servePublicGet(cache, kv, req(), next);
    expect(calls).toBe(1);

    await bumpIfMutating(kv, "POST", 200);

    const afterBump = await servePublicGet(cache, kv, req(), next);
    expect(calls).toBe(2);
    expect(await afterBump.text()).toBe("body-2");
  });
});

describe("bumpIfMutating", () => {
  it("bumps on a successful POST", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "POST", 200);
    expect(kv.store[PUBVER_KEY]).toBeTruthy();
  });

  it("does not bump on GET", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "GET", 200);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
  });

  it("does not bump on HEAD or OPTIONS", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "HEAD", 200);
    await bumpIfMutating(kv, "OPTIONS", 200);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
  });

  it("does not bump when status >= 400", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "PUT", 400);
    await bumpIfMutating(kv, "DELETE", 500);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
  });

  it("mutation bump only fires on non-GET success (integration-style check)", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "GET", 200);
    await bumpIfMutating(kv, "POST", 404);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
    await bumpIfMutating(kv, "POST", 201);
    expect(kv.store[PUBVER_KEY]).toBeTruthy();
  });

  it("uses a random token, not a counter (two bumps differ)", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "POST", 200);
    const first = kv.store[PUBVER_KEY];
    await bumpIfMutating(kv, "POST", 200);
    const second = kv.store[PUBVER_KEY];
    expect(first).not.toBe(second);
  });
});

describe("publicCacheMiddleware: schedule.ics (DEC-442)", () => {
  function buildApp(cache: CacheLike, kv: KVStore) {
    const app = new Hono<AppEnv>();
    app.use("*", publicCacheMiddleware(() => cache));
    let calls = 0;
    app.get("/e/:slug/schedule.ics", (c) => {
      calls += 1;
      return c.text(`ics-${calls}`, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
    });
    return { app, env: { KV: kv } as unknown as AppEnv["Bindings"], getCalls: () => calls };
  }

  it("a bare schedule.ics request is stored and served from cache on the second call, with client-facing Cache-Control restored", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    const first = await app.request("/e/foo/schedule.ics", {}, env);
    expect(await first.text()).toBe("ics-1");
    expect(getCalls()).toBe(1);
    expect(cache.store.size).toBe(1);

    const second = await app.request("/e/foo/schedule.ics", {}, env);
    expect(await second.text()).toBe("ics-1"); // served from cache, handler not called again
    expect(getCalls()).toBe(1);
    expect(second.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
  });

  it("a schedule.ics request with ?ids= is never stored", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    await app.request("/e/foo/schedule.ics?ids=1,2,3", {}, env);
    await app.request("/e/foo/schedule.ics?ids=1,2,3", {}, env);

    expect(getCalls()).toBe(2); // handler called every time, never cached
    expect(cache.store.size).toBe(0);
  });

  it("a mutation that bumps the public version makes a previously stored bare .ics unreachable", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    await app.request("/e/foo/schedule.ics", {}, env);
    expect(getCalls()).toBe(1);

    // still a hit before any bump
    await app.request("/e/foo/schedule.ics", {}, env);
    expect(getCalls()).toBe(1);

    await bumpIfMutating(kv, "POST", 200);

    const afterBump = await app.request("/e/foo/schedule.ics", {}, env);
    expect(getCalls()).toBe(2);
    expect(await afterBump.text()).toBe("ics-2");
  });
});

describe("bumpPublicVersionMiddleware (DEC-427)", () => {
  function buildApp(kv: KVStore) {
    const app = new Hono<AppEnv>();
    app.use("*", bumpPublicVersionMiddleware);
    app.post("/ok", (c) => c.text("done", 200));
    app.post("/redirect", (c) => c.redirect("/somewhere", 302));
    return { app, env: { KV: kv } as unknown as AppEnv["Bindings"] };
  }

  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("happy path: put succeeds and the version is rewritten", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "v0" });
    const { app, env } = buildApp(kv);

    const res = await app.request("/ok", { method: "POST" }, env);

    expect(res.status).toBe(200);
    expect(kv.store[PUBVER_KEY]).not.toBe("v0");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("a failed bump does not turn a 200 into a 500", async () => {
    const kv = throwingPutKv();
    const { app, env } = buildApp(kv);

    const res = await app.request("/ok", { method: "POST" }, env);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("done");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(PUBVER_KEY);
  });

  it("a failed bump does not clobber a 302 the handler produced", async () => {
    const kv = throwingPutKv();
    const { app, env } = buildApp(kv);

    const res = await app.request("/redirect", { method: "POST", redirect: "manual" }, env);

    expect(res.status).toBe(302);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("a missing KV binding still throws (configuration bug, not IO failure)", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", bumpPublicVersionMiddleware);
    app.post("/ok", (c) => c.text("done", 200));
    app.onError((err, c) => c.text(`error: ${(err as Error).message}`, 500));

    const res = await app.request("/ok", { method: "POST" }, {} as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(500);
    expect(await res.text()).toContain("requires the KV binding");
  });
});
