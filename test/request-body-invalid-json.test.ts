// DEC-635 (amendment, wave 21): a malformed request body must always land
// on the house 400 `invalid` envelope, never a silent 200 (the class of
// bug the wave-21 amendment's silent-default `.catch(() => ({}))` sites
// produced on all-optional PATCHes) and never an uncaught-SyntaxError 500.
// Drives two representative routes -- one all-optional PATCH and one
// create -- through their sub-app with a hand-typed non-JSON body. Follows
// the fake-db-chain harness in test/route-authz-inventory.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { taskRoutes } from "../src/routes/tasks";
import { embedsRoutes } from "../src/routes/api/embeds";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Mirrors test/route-authz-inventory.test.ts's appWithDb: a fake db that
 * answers a queued sequence of `select()` calls, an always-succeeding write
 * chain, and a fixed auth. */
function appWithDb(routes: Hono<AppEnv>, auth: AuthInfo, selects: unknown[][]) {
  let call = 0;
  const writeChain: any = {
    values: () => writeChain,
    set: () => writeChain,
    where: async () => undefined,
  };
  const db = {
    select: () => {
      const rows = selects[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => writeChain,
    update: () => writeChain,
    delete: () => writeChain,
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  // Mounted at /api/v1 (mirrors src/index.ts) rather than "/": DEC-841's
  // htmlSurface classification renders an HTML error page for any
  // non-/api/v1 path, so an unprefixed mount would mask the JSON envelope
  // assertion below with an HTML doctype instead.
  app.route("/api/v1", routes);
  return app;
}

const orgAAuth: AuthInfo = { userId: "u-org-a", role: "organizer", orgId: "org-a" };

async function postInvalidBody(app: Hono<AppEnv>, path: string, method: "PATCH" | "POST") {
  return app.request(
    path,
    {
      method,
      headers: { "x-chq-csrf": "1", "content-type": "application/json" },
      body: "not json",
    },
    {} as unknown as AppEnv["Bindings"],
  );
}

describe("DEC-635 amendment (wave 21): a malformed JSON body 400s, never 200 or 500", () => {
  it("PATCH /tasks/:id (all-optional) rejects a malformed body with 400 invalid, not a silent 200 no-op", async () => {
    // getTaskOwnership select -- ownership must resolve so the route reaches
    // the body read, proving the 400 comes from the reader, not an earlier
    // ownership 404/403.
    const app = appWithDb(taskRoutes, orgAAuth, [
      [{ eventId: "event-a", orgId: "org-a", kind: "general", title: "Do the thing" }],
    ]);
    const res = await postInvalidBody(app, "/api/v1/tasks/task-1", "PATCH");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("invalid");
  });

  it("POST /events/:eventId/embeds (create) rejects a malformed body with 400 invalid, not a silent 200 or a 500", async () => {
    // getEventOrgId select -- event ownership must resolve so the route
    // reaches the body read.
    const app = appWithDb(embedsRoutes, orgAAuth, [[{ orgId: "org-a" }]]);
    const res = await postInvalidBody(app, "/api/v1/events/event-a/embeds", "POST");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("invalid");
  });
});
