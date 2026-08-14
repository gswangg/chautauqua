// DEC-433 amendment (wave 44): versionedCacheKey builds a CANONICAL cache
// key (origin + pathname + only PUBLIC_CACHE_KEY_PARAMS, in fixed order,
// + __chqv last). Behaviour tests against servePublicGet using the same
// in-memory CacheLike/KVStore fakes as test/pubcache.test.ts.

import { describe, expect, it } from "vitest";
import { servePublicGet, type CacheLike } from "../src/server/pubcache";
import type { KVStore } from "../src/lib/draft";

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

function counter() {
  let calls = 0;
  const next = async () => {
    calls += 1;
    return new Response(`hit-${calls}`, { status: 200 });
  };
  return { next, callsRef: () => calls };
}

describe("versionedCacheKey canonicalization", () => {
  it("two GETs differing only by a tracking param share one stored entry", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { next, callsRef } = counter();

    const first = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    expect(await first.text()).toBe("hit-1");

    const second = await servePublicGet(
      cache,
      kv,
      new Request("https://x.test/e/foo/sessions?utm_source=newsletter&fbclid=abc"),
      next,
    );
    expect(await second.text()).toBe("hit-1"); // served from the same cache entry
    expect(callsRef()).toBe(1);
    expect(cache.store.size).toBe(1);
  });

  it("two GETs differing by trackId do not share an entry", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { next, callsRef } = counter();

    const first = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions?trackId=t1"), next);
    expect(await first.text()).toBe("hit-1");

    const second = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions?trackId=t2"), next);
    expect(await second.text()).toBe("hit-2");
    expect(callsRef()).toBe(2);
    expect(cache.store.size).toBe(2);
  });

  it("/embed/e/:id?anything=1 shares the bare entry", async () => {
    const cache = fakeCache();
    const kv = fakeKv();
    const { next, callsRef } = counter();

    const first = await servePublicGet(cache, kv, new Request("https://x.test/embed/e/abc123"), next);
    expect(await first.text()).toBe("hit-1");

    const second = await servePublicGet(cache, kv, new Request("https://x.test/embed/e/abc123?anything=1"), next);
    expect(await second.text()).toBe("hit-1");
    expect(callsRef()).toBe(1);
    expect(cache.store.size).toBe(1);
  });

  it("a caller-supplied __chqv cannot select a stale entry", async () => {
    const cache = fakeCache();
    const kv = fakeKv({ ["chq:pubver"]: "v1" });
    const { next, callsRef } = counter();

    const first = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    expect(await first.text()).toBe("hit-1");
    expect(callsRef()).toBe(1);

    // A caller trying to force a lookup under a different (e.g. stale)
    // version by supplying their own __chqv must be ignored: the real
    // KV-read version (v1) still wins, and this is still a cache hit.
    const second = await servePublicGet(
      cache,
      kv,
      new Request("https://x.test/e/foo/sessions?__chqv=stale-version"),
      next,
    );
    expect(await second.text()).toBe("hit-1");
    expect(callsRef()).toBe(1);
    expect(cache.store.size).toBe(1);
  });

  it("a version bump still misses", async () => {
    const cache = fakeCache();
    const kv = fakeKv({ ["chq:pubver"]: "v1" });
    const { next, callsRef } = counter();

    const first = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    expect(await first.text()).toBe("hit-1");

    kv.store["chq:pubver"] = "v2";

    const second = await servePublicGet(cache, kv, new Request("https://x.test/e/foo/sessions"), next);
    expect(await second.text()).toBe("hit-2");
    expect(callsRef()).toBe(2);
    expect(cache.store.size).toBe(2);
  });
});
