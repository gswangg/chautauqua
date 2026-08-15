// DEC-083: purge-on-publish edge caching. Core logic is pure against
// CacheLike + KVStore (src/lib/draft.ts), so it unit-tests with fakes —
// no real Cache API / KVNamespace required.

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_CACHE_CONTROL,
  PUBVER_KEY,
  affectsPublicOutput,
  bumpIfMutating,
  bumpPublicVersionMiddleware,
  isUncacheableIcsRequest,
  publicCacheMiddleware,
  readPublicVersion,
  servePublicGet,
  versionedCacheKey,
  type CacheLike,
} from "../src/server/pubcache";
import { MAX_PUBLIC_QUERY_VALUE_LENGTH } from "../src/server/repo/public/bounds";
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
    const next = async () => new Response("ok", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", Vary: "Cookie" } });

    await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("DEC-099 wave-34 amendment: the object handed to cache.put carries NO Vary, even when the handler's response had one", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () =>
      new Response("ok", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", Vary: "Cookie" } });

    await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get("Vary")).toBeNull();
  });

  it("DEC-099: a hit is re-served with the client-facing Cache-Control, not the stored 86400 override", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () =>
      new Response("hello", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", Vary: "Cookie" } });

    const req = () => new Request("https://x.test/e/foo/sessions");
    const miss = await servePublicGet(cache, kv, req(), next);
    expect(miss.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=300");

    const hit = await servePublicGet(cache, kv, req(), next);
    expect(await hit.text()).toBe("hello");
    expect(hit.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
    // DEC-099 wave-34 amendment: a cache-hit response carries both the
    // client-facing Cache-Control override AND Vary: Cookie, restored fresh
    // on every hit (the stored copy itself has neither the 86400 override
    // nor Vary — see the two assertions below and the sibling "carries NO
    // Vary" test above).
    expect(hit.headers.get("Vary")).toBe("Cookie");

    // the copy inside the cache itself is untouched — still the internal 86400 override
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(stored.headers.get("Vary")).toBeNull();
  });

  it("DEC-083 amendment (wave 10): two consecutive identical GETs against the same cache instance both get the full body and client-facing Cache-Control, even when the CacheLike returns the same Response object on repeat match()", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () =>
      new Response("hello", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });

    const req = () => new Request("https://x.test/e/foo/sessions");
    await servePublicGet(cache, kv, req(), next); // miss: populates the cache

    const first = await servePublicGet(cache, kv, req(), next); // hit #1
    expect(await first.text()).toBe("hello");
    expect(first.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);

    const second = await servePublicGet(cache, kv, req(), next); // hit #2 against the same stored Response
    expect(await second.text()).toBe("hello");
    expect(second.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
  });

  it("does not cache non-200 responses, and does not add Vary to a 404/no-store path it never touches", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () => new Response("not found", { status: 404, headers: { "Cache-Control": "no-store" } });

    const response = await servePublicGet(cache, kv, new Request("https://x.test/e/missing/sessions"), next);
    expect(cache.store.size).toBe(0);
    // DEC-099 wave-34 amendment: servePublicGet never adds Vary itself — it
    // only strips/restores whatever the caller's handler already set (via
    // setCacheHeaders). A 404 handler that never calls setCacheHeaders
    // (public.tsx's own not-found branches don't) is unaffected either way.
    expect(response.headers.get("Vary")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
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

    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 200);

    const afterBump = await servePublicGet(cache, kv, req(), next);
    expect(calls).toBe(2);
    expect(await afterBump.text()).toBe("body-2");
  });

  it("wave 15 (DEC-083 amendment): with a waitUntil, a never-resolving cache.put does not delay the returned response, and the collector still receives exactly one put with the version-salted key", async () => {
    const kv = fakeKv();
    const puts: Array<{ url: string }> = [];
    const cache: CacheLike = {
      async match() {
        return undefined;
      },
      put(request) {
        puts.push({ url: request.url });
        return new Promise(() => {}); // never resolves
      },
    };
    const collected: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => collected.push(p);
    const next = async () => new Response("hello", { status: 200, headers: { "Cache-Control": "public, max-age=60" } });

    const response = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next, waitUntil);

    expect(await response.text()).toBe("hello");
    expect(puts).toEqual([{ url: "https://x.test/e/foo/sessions?__chqv=v0" }]);
    expect(collected).toHaveLength(1);
  });

  it("wave 15: the returned response on a miss keeps the handler's own Cache-Control, while the stored copy carries the 86400 override", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const next = async () => new Response("hello", { status: 200, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });

    const response = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=300");
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });
});

describe("bumpIfMutating", () => {
  it("bumps on a successful POST", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 200);
    expect(kv.store[PUBVER_KEY]).toBeTruthy();
  });

  it("does not bump on GET", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "GET", "/api/v1/contacts", 200);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
  });

  it("does not bump on HEAD or OPTIONS", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "HEAD", "/api/v1/contacts", 200);
    await bumpIfMutating(kv, "OPTIONS", "/api/v1/contacts", 200);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
  });

  it("does not bump when status >= 400", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "PUT", "/api/v1/contacts", 400);
    await bumpIfMutating(kv, "DELETE", "/api/v1/contacts", 500);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
  });

  it("mutation bump only fires on non-GET success (integration-style check)", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "GET", "/api/v1/contacts", 200);
    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 404);
    expect(kv.store[PUBVER_KEY]).toBeUndefined();
    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 201);
    expect(kv.store[PUBVER_KEY]).toBeTruthy();
  });

  it("uses a random token, not a counter (two bumps differ)", async () => {
    const kv = fakeKv();
    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 200);
    const first = kv.store[PUBVER_KEY];
    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 200);
    const second = kv.store[PUBVER_KEY];
    expect(first).not.toBe(second);
  });
});

describe("versionedCacheKey (DEC-433 amendment, wave 45): overlong values key like absence, not like a bypass", () => {
  it("a keyed param (q) over the cap is dropped from the key, keying identically to no q at all", () => {
    const over = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH + 1);
    const withOver = versionedCacheKey(`https://x.test/e/foo/sessions?q=${over}`, "v0");
    const withoutQ = versionedCacheKey("https://x.test/e/foo/sessions", "v0");
    expect(withOver.url).toBe(withoutQ.url);
  });

  it("a keyed param (q) within the cap still keys distinctly from absence and from another in-cap value", () => {
    const atCap = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH);
    const withQ = versionedCacheKey(`https://x.test/e/foo/sessions?q=${atCap}`, "v0");
    const withoutQ = versionedCacheKey("https://x.test/e/foo/sessions", "v0");
    const withOtherQ = versionedCacheKey("https://x.test/e/foo/sessions?q=keynote", "v0");
    expect(withQ.url).not.toBe(withoutQ.url);
    expect(withQ.url).not.toBe(withOtherQ.url);
  });

  it("a non-keyed param (utm_source) of any length is already dropped, cap or no cap — behaviour unchanged", () => {
    const huge = "a".repeat(5000);
    const withUtm = versionedCacheKey(`https://x.test/e/foo/sessions?utm_source=${huge}`, "v0");
    const bare = versionedCacheKey("https://x.test/e/foo/sessions", "v0");
    expect(withUtm.url).toBe(bare.url);
  });
});

describe("publicCacheMiddleware: overlong param no longer bypasses the cache (DEC-433 amendment, wave 45)", () => {
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

  it("two GETs differing only in a 5,000-char NON-keyed param resolve to the same key: second is a hit, exactly one cache.put across both", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);
    const huge = "a".repeat(5000);
    let puts = 0;
    const countingCache: CacheLike = {
      match: (r) => cache.match(r),
      put: (r, res) => {
        puts += 1;
        return cache.put(r, res);
      },
    };
    const app2 = new Hono<AppEnv>();
    app2.use("*", publicCacheMiddleware(() => countingCache));
    let calls = 0;
    app2.get("/e/:slug/sessions", (c) => {
      calls += 1;
      return c.text(`sessions-${calls}`, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
    });

    const first = await app2.request(`/e/foo/sessions?utm_source=${huge}`, {}, env);
    expect(await first.text()).toBe("sessions-1");
    const second = await app2.request(`/e/foo/sessions?utm_source=${huge.slice(1)}newval`, {}, env);
    expect(await second.text()).toBe("sessions-1"); // served from cache — utm_source never part of the key

    expect(calls).toBe(1);
    expect(puts).toBe(1);
    void app;
    void getCalls;
  });

  it("an over-cap ?q= request IS now cached (no bypass): served with client-facing Cache-Control on the hit", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);
    const long = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH + 1);

    const first = await app.request(`/e/foo/sessions?q=${long}`, {}, env);
    expect(await first.text()).toBe("sessions-1");
    expect(cache.store.size).toBe(1);

    const second = await app.request(`/e/foo/sessions?q=${long}`, {}, env);
    expect(await second.text()).toBe("sessions-1"); // hit, not re-run
    expect(getCalls()).toBe(1);
    expect(second.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
  });

  it("an ordinary filtered request (within the cap) still caches, with the same version-salted key shape", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { app, env, getCalls } = buildApp(cache, kv);

    const first = await app.request("/e/foo/sessions?q=keynote", {}, env);
    expect(await first.text()).toBe("sessions-1");
    expect(getCalls()).toBe(1);
    expect(cache.store.size).toBe(1);
    const storedUrl = [...cache.store.keys()][0]!;
    const storedParams = new URL(storedUrl).searchParams;
    expect(storedParams.get("q")).toBe("keynote");
    expect(storedParams.get("__chqv")).toBe("v0");

    const second = await app.request("/e/foo/sessions?q=keynote", {}, env);
    expect(await second.text()).toBe("sessions-1"); // served from cache
    expect(getCalls()).toBe(1);
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

    await bumpIfMutating(kv, "POST", "/api/v1/contacts", 200);

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

describe("affectsPublicOutput (DEC-627)", () => {
  it("is always false for GET/HEAD/OPTIONS, regardless of path", () => {
    expect(affectsPublicOutput("GET", "/api/v1/events/e1/submissions/status")).toBe(false);
    expect(affectsPublicOutput("HEAD", "/portal/profile")).toBe(false);
    expect(affectsPublicOutput("OPTIONS", "/login")).toBe(false);
  });

  it("NEVER-PUBLIC: login/logout/claim/account/tokens/views/plans/review/templates/tasks/users never bump", () => {
    expect(affectsPublicOutput("POST", "/login")).toBe(false);
    expect(affectsPublicOutput("POST", "/logout")).toBe(false);
    expect(affectsPublicOutput("POST", "/claim/tok123")).toBe(false);
    expect(affectsPublicOutput("POST", "/account/password")).toBe(false);
    expect(affectsPublicOutput("DELETE", "/api/v1/tokens/t1")).toBe(false);
    expect(affectsPublicOutput("DELETE", "/api/v1/views/v1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/views")).toBe(false);
    expect(affectsPublicOutput("PATCH", "/api/v1/plans/p1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/plans")).toBe(false);
    expect(affectsPublicOutput("PUT", "/api/v1/review/plans/p1/evaluations/s1")).toBe(false);
    expect(affectsPublicOutput("DELETE", "/api/v1/review/plans/p1/recusals/s1")).toBe(false);
    expect(affectsPublicOutput("PATCH", "/api/v1/templates/t1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/compose/send")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/contacts/bulk-email")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/segments")).toBe(false);
    expect(affectsPublicOutput("PATCH", "/api/v1/pipeline/p1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/tasks")).toBe(false);
    expect(affectsPublicOutput("PATCH", "/api/v1/tasks/t1")).toBe(false);
    expect(affectsPublicOutput("PATCH", "/api/v1/task-assignments/a1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/onboarding/remind")).toBe(false);
    expect(affectsPublicOutput("PUT", "/api/v1/events/e1/portal-settings")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/resources")).toBe(false);
    expect(affectsPublicOutput("DELETE", "/api/v1/resources/r1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/files/f1/comments")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/files/archive")).toBe(false);
    expect(affectsPublicOutput("DELETE", "/api/v1/files/f1")).toBe(false);
    expect(affectsPublicOutput("PATCH", "/api/v1/forms/f1")).toBe(false);
    expect(affectsPublicOutput("DELETE", "/api/v1/fields/fl1")).toBe(false);
    expect(affectsPublicOutput("POST", "/api/v1/users")).toBe(false);
    expect(affectsPublicOutput("POST", "/portal/tasks/a1/complete")).toBe(false);
    expect(affectsPublicOutput("POST", "/portal/tasks/a1/form")).toBe(false);
    expect(affectsPublicOutput("POST", "/portal/tasks/a1/comments")).toBe(false);
  });

  it("PUBLIC-AFFECTING: events/tracks/rooms/submissions/agenda/contacts/portal-submission writes bump", () => {
    expect(affectsPublicOutput("POST", "/api/v1/events")).toBe(true);
    expect(affectsPublicOutput("PATCH", "/api/v1/tracks/t1")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/rooms")).toBe(true);
    expect(affectsPublicOutput("PATCH", "/api/v1/submissions/s1")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/submissions/s1/clone")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/submissions/status")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/submissions/s1/content-status")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/submissions/s1/files")).toBe(true);
    expect(affectsPublicOutput("POST", "/portal/tasks/a1/upload")).toBe(true);
    expect(affectsPublicOutput("PUT", "/api/v1/submissions/s1/slot")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/agenda/publish")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/events/e1/agenda/auto-schedule")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/contacts/c1/headshot")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/contacts/import")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/contacts/merge")).toBe(true);
    expect(affectsPublicOutput("POST", "/api/v1/contacts/c1/add-to-event")).toBe(true);
    expect(affectsPublicOutput("POST", "/portal/submissions/s1/edit")).toBe(true);
    expect(affectsPublicOutput("POST", "/portal/profile")).toBe(true);
    expect(affectsPublicOutput("POST", "/portal/invitations/p1")).toBe(true);
  });

  it("fail-safe: an unclassified mutating path bumps by default", () => {
    expect(affectsPublicOutput("POST", "/api/v1/some-new-endpoint-nobody-classified-yet")).toBe(true);
  });
});

describe("DEC-627: publish-affecting classification through the real middleware", () => {
  function buildApp(kv: KVStore) {
    const app = new Hono<AppEnv>();
    app.use("*", bumpPublicVersionMiddleware);
    app.post("/login", (c) => c.text("ok", 200));
    app.put("/api/v1/review/plans/:planId/evaluations/:submissionId", (c) => c.text("ok", 200));
    app.post("/api/v1/events/:eventId/submissions/status", (c) => c.text("ok", 200));
    app.post("/portal/profile", (c) => c.text("ok", 200));
    return { app, env: { KV: kv } as unknown as AppEnv["Bindings"] };
  }

  it("POST /login leaves chq:pubver untouched", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "v0" });
    const { app, env } = buildApp(kv);
    await app.request("/login", { method: "POST" }, env);
    expect(kv.store[PUBVER_KEY]).toBe("v0");
  });

  it("a reviewer evaluation PUT leaves chq:pubver untouched", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "v0" });
    const { app, env } = buildApp(kv);
    await app.request("/api/v1/review/plans/p1/evaluations/s1", { method: "PUT" }, env);
    expect(kv.store[PUBVER_KEY]).toBe("v0");
  });

  it("a submission status write bumps chq:pubver", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "v0" });
    const { app, env } = buildApp(kv);
    await app.request("/api/v1/events/e1/submissions/status", { method: "POST" }, env);
    expect(kv.store[PUBVER_KEY]).not.toBe("v0");
  });

  it("a portal profile save bumps chq:pubver", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "v0" });
    const { app, env } = buildApp(kv);
    await app.request("/portal/profile", { method: "POST" }, env);
    expect(kv.store[PUBVER_KEY]).not.toBe("v0");
  });
});
