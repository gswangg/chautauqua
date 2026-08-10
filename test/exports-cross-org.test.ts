// w12-c PLANNER item #3 (docs/verification-log.md): scripts/seed.ts seeds
// exactly one org, so the walkthrough's "another org's eventId -> 404"
// export check falls back to a nonexistent eventId rather than a genuine
// cross-org id — it exercises the not-found branch but not true
// cross-tenant isolation on that surface specifically. Fixture data must
// stay seed-only (no-eval-gaming rule), so this constructs two orgs'
// worth of rows directly against a fake db, mirroring the mock pattern
// used by test/headshot-gate.test.ts, to assert requireOwnedEvent
// (src/routes/api/exports.ts) genuinely 404s org B's organizer on org A's
// real eventId — not just a made-up id.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ORG_A = { id: "event-org-a", orgId: "org-a", recordPrefix: "SES" };

// Two sequential .limit()-terminated selects (requireOwnedEvent's event
// lookup, then exportSubmissions' getRecordPrefix), followed by a bare
// .where()-terminated select (the submissions query itself) that returns
// zero rows so exportSubmissions short-circuits to an empty table.
function fakeDb(eventRow: { id: string; orgId: string; recordPrefix: string } | undefined) {
  let call = 0;
  function makeChain(limitRows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      limit: async () => limitRows,
      then: (resolve: (v: unknown[]) => void) => resolve([]),
    };
    return chain;
  }
  return {
    select: () => {
      call += 1;
      if (call <= 2) return makeChain(eventRow ? [eventRow] : []);
      return makeChain([]);
    },
  } as unknown as AppEnv["Variables"]["db"];
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/", exportsRoutes);
  return app;
}

describe("GET /api/v1/events/:eventId/export/:kind — cross-org isolation (w12-c PLANNER #3)", () => {
  it("404s a genuinely different org's organizer on org A's real eventId (not a nonexistent id)", async () => {
    const orgBOrganizer: AuthInfo = { userId: "u-org-b", role: "organizer", orgId: "org-b" };
    const app = appWithDbAndAuth(fakeDb(EVENT_ORG_A), orgBOrganizer);
    const res = await app.request(`/api/v1/events/${EVENT_ORG_A.id}/export/submissions?format=csv`);
    expect(res.status).toBe(404);
  });

  it("200s org A's own organizer on the same real eventId — sanity check that the fake db round-trips a match", async () => {
    const orgAOrganizer: AuthInfo = { userId: "u-org-a", role: "organizer", orgId: "org-a" };
    const app = appWithDbAndAuth(fakeDb(EVENT_ORG_A), orgAOrganizer);
    const res = await app.request(`/api/v1/events/${EVENT_ORG_A.id}/export/submissions?format=csv`);
    expect(res.status).toBe(200);
  });
});
