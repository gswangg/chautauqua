// DEC-911: the CFP surface's 404s route through the designed public card
// (publicNotFound / PublicNotFoundShell), not a bare c.text plain-text
// body. Mounts the real publicSubmitRoutes sub-app against a minimal fake
// db, mirroring the fakeDb pattern in test/submit-draft-notice.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

describe("GET /submit/:eventSlug 404s (DEC-911)", () => {
  it("renders the designed PublicNotFoundShell (not the bare string) for an unknown slug", async () => {
    // getEventBySlug's select resolves to no rows -> event not found.
    const db = fakeDb([[]]);
    const app = appWithDb(db);

    const res = await app.request(
      "/submit/no-such-event",
      { headers: {} },
      { KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.text();
    expect(body).not.toBe("Event not found.");
    expect(body).toContain("That page isn&#39;t here");
    expect(body).toContain("Event not found.");
  });

  it("renders the designed PublicNotFoundShell when the event has no open/default form", async () => {
    // getEventBySlug resolves the event; getDefaultForm resolves no rows.
    const db = fakeDb([[EVENT_ROW], []]);
    const app = appWithDb(db);

    const res = await app.request(
      "/submit/test-conf",
      { headers: {} },
      { KV: fakeKv() } as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).not.toBe("This event is not accepting submissions yet.");
    expect(body).toContain("That page isn&#39;t here");
    expect(body).toContain("This event is not accepting submissions yet.");
  });
});
