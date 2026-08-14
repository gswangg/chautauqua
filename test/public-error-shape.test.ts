// DEC-841: one error responder (errorResponse in src/server/http.ts) — a
// sub-app's onError (publicRoutes' onError, DEC-324) may override headers
// (Cache-Control: no-store) but never construct the body itself. This file
// proves (1) the public sub-app's HTML error shape is unchanged and still
// carries no-store, (2) the API JSON shape is unchanged, and (3) no other
// route file hand-builds an error body inside a `.onError(` block.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler, ApiError } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { MAX_ITINERARY_IDS } from "../src/lib/itinerary";

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {
      /* no-op */
    },
    async delete() {
      /* no-op */
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

// getPublicEventBySlug's only query: select().from().where().limit().
function eventOnlyDb() {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve([EVENT_ROW]),
  };
  return {
    select: () => chain,
  } as unknown as AppEnv["Variables"]["db"];
}

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", eventOnlyDb());
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

describe("public sub-app error shape (DEC-841)", () => {
  it("an ApiError thrown on an HTML public surface (/e/*) renders HTML with no JSON envelope, and keeps no-store", async () => {
    installFakeCaches();
    const app = buildApp();
    // schedule.ics throws ApiError('invalid', ...) when over MAX_ITINERARY_IDS
    // ids are requested — reached before any further DB query.
    const ids = Array.from({ length: MAX_ITINERARY_IDS + 1 }, (_, i) => `s${i}`).join(",");
    const res = await app.request(`/e/conf/schedule.ics?ids=${ids}`, {}, TEST_ENV);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).not.toContain('"error"');
    expect(body).toContain("Too many ids");
  });

  it("the same throw on an /api/v1 path still returns the JSON envelope", async () => {
    installFakeCaches();
    const app = buildApp();
    app.get("/api/v1/probe", () => {
      throw new ApiError("invalid", "Too many ids: probe");
    });
    const res = await app.request("/api/v1/probe", {}, TEST_ENV);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const jsonBody = (await res.json()) as { error: { code: string; message: string } };
    expect(jsonBody).toEqual({ error: { code: "invalid", message: "Too many ids: probe" } });
  });

  it("no route file other than src/server/http.ts constructs an error body inside a .onError( block", () => {
    const root = join(__dirname, "..", "src", "routes");
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const info = statSync(full);
        if (info.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        const contents = readFileSync(full, "utf8");
        if (!contents.includes(".onError(")) continue;
        if (!contents.includes("errorResponse")) offenders.push(full);
      }
    }

    walk(root);
    expect(offenders).toEqual([]);
  });
});
