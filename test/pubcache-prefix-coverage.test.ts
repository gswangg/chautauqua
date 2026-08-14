// DEC-083 wave-22 amendment: proves at runtime -- not by reading the
// registration lines -- that publicCacheMiddleware runs EXACTLY once per
// request for each of the three cached URL shapes (/e/*, /embed/*, and the
// saved-embed /embed/e/:embedId sub-app), and that a served response never
// carries a Set-Cookie header (the invariant that makes a shared edge copy
// safe to hand to the next visitor). Mounts the REAL publicRoutes sub-app
// (src/routes/public/index.tsx), which itself mounts savedEmbedRoutes
// (src/routes/public/saved-embed.tsx) via publicRoutes.route("/", ...) --
// this is what makes "how many times did the middleware run" a fact about
// Hono's compose(), not about how many `.use()` lines this file counted.
//
// Harness (fakeKv/installFakeCaches/fake-db chain) copied in shape from
// test/public.test.ts:125-176 -- this file does not edit that one.

import { describe, expect, it, afterEach } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { PUBVER_KEY } from "../src/server/pubcache";
import type { AppEnv } from "../src/server/env";

// Counting KV fake: same shape as test/public.test.ts's fakeKv, but tallies
// .get() calls against PUBVER_KEY so the test can assert an exact count.
function makeCountingKv() {
  let getCalls = 0;
  return {
    kv: {
      async get(key: string) {
        if (key === PUBVER_KEY) getCalls += 1;
        return null;
      },
      async put() {
        /* no-op */
      },
      async delete() {
        /* no-op */
      },
    },
    getCallCount: () => getCalls,
  };
}

// Counting cache fake: same shape as test/public.test.ts's installFakeCaches,
// but tallies .match() calls (a permanently-empty cache -- match always
// undefined -- keeps every request exercising the real render path, exactly
// like the established pattern this mirrors).
function installCountingFakeCaches(): { matchCallCount: () => number } {
  let matchCalls = 0;
  (globalThis as any).caches = {
    default: {
      async match() {
        matchCalls += 1;
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
  return { matchCallCount: () => matchCalls };
}

// A db stub whose lookups all resolve empty -- every route under test here
// (getPublicEventBySlug, getEmbedById) does a single `.select().from().where().limit()`
// chain. An empty result drives the 404 render path, which still exercises
// publicCacheMiddleware fully (these assertions are about middleware passes,
// not rendered content).
function makeEmptyDb() {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => [],
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve([]),
  };
  return {
    select: () => chain,
    selectDistinct: () => chain,
  } as unknown as AppEnv["Variables"]["db"];
}

function buildApp() {
  const db = makeEmptyDb();
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

afterEach(() => {
  delete (globalThis as any).caches;
});

describe("DEC-083: public cache middleware runs exactly once per cached-prefix request", () => {
  const cases: Array<{ label: string; path: string }> = [
    { label: "/e/*", path: "/e/conf/sessions" },
    { label: "/embed/*", path: "/embed/conf/sessions" },
    // Saved-embed sub-app, mounted BEFORE /embed/* in publicRoutes.route("/",
    // savedEmbedRoutes) -- if that ordering (or savedEmbedRoutes' own
    // .use("/embed/e/*", ...) line) were ever removed, this request would
    // either fall through uncached (0 matches) or double up through both
    // the sub-app's own middleware AND the parent's /embed/* middleware
    // (2 matches) once the generic route below it also matched.
    { label: "/embed/e/:embedId (saved embed)", path: "/embed/e/some-embed-id" },
  ];

  for (const { label, path } of cases) {
    it(`${label} (${path}): kv.get(PUBVER_KEY) once, cache.match once, no Set-Cookie`, async () => {
      const app = buildApp();
      const { kv, getCallCount } = makeCountingKv();
      const { matchCallCount } = installCountingFakeCaches();
      const env = { KV: kv, DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

      const res = await app.request(path, {}, env);

      // 0 would mean the prefix fell out of the cache (middleware never ran);
      // 2 would mean nested double-caching (both parent and sub-app
      // registrations wrapped the same request). Only 1 is correct.
      expect(getCallCount()).toBe(1);
      expect(matchCallCount()).toBe(1);
      // A cached response must never carry a per-visitor Set-Cookie -- that's
      // what makes handing the shared edge copy to the NEXT visitor safe.
      expect(res.headers.get("Set-Cookie")).toBeNull();
    });
  }
});
