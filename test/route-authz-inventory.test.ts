// DEC-459 enumeration lane (task-w18-d): runtime probes proving the
// object-level ownership guards claimed in
// docs/verification-log/task-w18-d-route-authz-inventory-stage1.md for a
// representative set of the highest-risk rows -- every route taking an
// `:id` whose ownership check happens in the ROUTE HANDLER itself (not
// filtered directly in the repo's own SQL WHERE clause), which is the
// class of check a future refactor could most easily drop by accident.
// Follows the established fake-db-chain pattern (see
// test/agenda-room-ownership.test.ts) rather than a real D1/wrangler
// round trip.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { viewsRoutes } from "../src/routes/api/views";
import { taskRoutes } from "../src/routes/tasks";
import { tokensRoutes } from "../src/routes/api/tokens";
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

/** Builds a minimal Hono app wired with a fake db that answers a queued
 * sequence of `select()` calls, an always-succeeding write chain (insert/
 * update/delete), and a fixed auth. Mirrors the harness in
 * test/agenda-room-ownership.test.ts. */
function appWithDb(routes: Hono<AppEnv>, auth: AuthInfo, selects: unknown[][]) {
  let call = 0;
  const nextRows = () => {
    const rows = selects[call] ?? [];
    call += 1;
    return rows;
  };
  // `where()` stays chainable (rather than resolving directly) so a caller
  // that appends `.returning()` (e.g. updateTask's collapsed
  // update-then-returning, DEC-948) draws its rows from the same queued
  // `selects` sequence a bare `.select()` would have. A caller that awaits
  // `.where()` directly (no `.returning()`) still resolves via `then`.
  const writeChain: any = {
    values: () => writeChain,
    set: () => writeChain,
    where: () => writeChain,
    returning: async () => nextRows(),
    then: (resolve: (v: unknown) => void) => resolve(undefined),
  };
  const db = {
    select: () => makeChain(nextRows()),
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
  app.route("/", routes);
  return app;
}

const orgAAuth: AuthInfo = { userId: "u-org-a", role: "organizer", orgId: "org-a" };

describe("DELETE /api/v1/views/:id (DEC-031) — app-level orgId comparison, not SQL-filtered", () => {
  it("404s when the saved view's event belongs to a different org (IDOR, existence-hiding, never 403)", async () => {
    // getSavedViewOwnership returns the row regardless of org; the route
    // itself must compare ownership.orgId to auth.orgId and reject. Legacy
    // (null createdByUserId) row so this exercises only the org-level gate,
    // not the DEC-975 author/shared gate.
    const app = appWithDb(viewsRoutes, orgAAuth, [
      [{ eventId: "event-b", orgId: "org-b", createdByUserId: null, shared: true }],
    ]);
    const res = await app.request(
      "/views/view-1",
      { method: "DELETE", headers: { "x-chq-csrf": "1" } },
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(404);
  });

  it("succeeds (200) when the saved view belongs to the caller's own org", async () => {
    // Legacy (null createdByUserId) row: any organiser in the org may
    // delete it (DEC-975), so this exercises only the org-level gate.
    const app = appWithDb(viewsRoutes, orgAAuth, [
      [{ eventId: "event-a", orgId: "org-a", createdByUserId: null, shared: true }],
    ]);
    const res = await app.request(
      "/views/view-1",
      { method: "DELETE", headers: { "x-chq-csrf": "1" } },
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/v1/tasks/:id (DEC-023) — app-level orgId comparison", () => {
  it("404s when the task's event belongs to a different org (IDOR, existence-hiding, never 403)", async () => {
    const app = appWithDb(taskRoutes, orgAAuth, [[{ eventId: "event-b", orgId: "org-b", kind: "general" }]]);
    const res = await app.request(
      "/tasks/task-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ title: "Renamed by attacker" }),
      },
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(404);
  });

  it("succeeds (200) when the task belongs to the caller's own org", async () => {
    const app = appWithDb(taskRoutes, orgAAuth, [
      [{ eventId: "event-a", orgId: "org-a", kind: "general" }], // getTaskOwnership
      [{ id: "task-1", eventId: "event-a", kind: "general", title: "Renamed", description: null, dueDate: null, required: false, formId: null, deliverableKind: null, assignToAllAccepted: 0, createdAt: new Date(), updatedAt: new Date() }], // updateTask's post-write select
    ]);
    const res = await app.request(
      "/tasks/task-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ title: "Renamed" }),
      },
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/tokens/:id (DEC-027) — app-level orgId comparison", () => {
  it("404s when the token belongs to a different org (IDOR)", async () => {
    const app = appWithDb(tokensRoutes, orgAAuth, [[{ id: "tok-1", orgId: "org-b" }]]);
    const res = await app.request(
      "/api/v1/tokens/tok-1",
      { method: "DELETE", headers: { "x-chq-csrf": "1" } },
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(404);
  });

  it("succeeds (200) when the token belongs to the caller's own org", async () => {
    const app = appWithDb(tokensRoutes, orgAAuth, [[{ id: "tok-1", orgId: "org-a" }]]);
    const res = await app.request(
      "/api/v1/tokens/tok-1",
      { method: "DELETE", headers: { "x-chq-csrf": "1" } },
      {} as unknown as AppEnv["Bindings"],
    );
    expect(res.status).toBe(200);
  });
});
