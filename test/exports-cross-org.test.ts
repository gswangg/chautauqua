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
//
// task-w14-h extends this to (a) enumerate every export kind returned by
// isExportKind/EXPORT_KINDS (src/server/repo/exports.ts), not just
// 'submissions', (b) cover the separate DEC-055 showflow.csv route, (c)
// assert the nonexistent-event path still 404s, and (d) make the fake db
// throw -- rather than silently returning empty rows -- if any query runs
// after the ownership check, proving isolation short-circuits before any
// export data access rather than merely filtering results afterward.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler } from "../src/server/http";
import { EXPORT_KINDS, isExportKind } from "../src/server/repo/exports";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ORG_A = { id: "event-org-a", orgId: "org-a" };

// Exactly one queued response: requireOwnedEvent's own event lookup
// (src/routes/api/exports.ts). Any select beyond that -- i.e. any of the
// export kinds' own data queries, which only run once ownership passes --
// throws, proving the ownership check genuinely short-circuits before data
// access rather than just filtering rows after fetching them.
function fakeDbOwnershipOnly(eventRow: { id: string; orgId: string } | undefined) {
  let call = 0;
  function makeChain(): any {
    const chain: any = {};
    for (const m of ["from", "innerJoin", "leftJoin", "where", "orderBy", "offset"]) chain[m] = () => chain;
    chain.limit = async () => {
      call += 1;
      if (call > 1) {
        throw new Error(
          `fake db: unexpected query #${call} ran after requireOwnedEvent -- cross-org isolation must ` +
            "short-circuit before any export data query executes.",
        );
      }
      return eventRow ? [eventRow] : [];
    };
    chain.then = (resolve: (v: unknown[]) => void) => {
      call += 1;
      if (call > 1) {
        throw new Error(
          `fake db: unexpected query #${call} ran after requireOwnedEvent -- cross-org isolation must ` +
            "short-circuit before any export data query executes.",
        );
      }
      resolve([]);
    };
    return chain;
  }
  return { select: () => makeChain() } as unknown as AppEnv["Variables"]["db"];
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

const ORG_B_ORGANIZER: AuthInfo = { userId: "u-org-b", role: "organizer", orgId: "org-b" };

describe("GET /api/v1/events/:eventId/export/:kind — cross-org isolation, all kinds (w12-c PLANNER #3, task-w14-h)", () => {
  it("EXPORT_KINDS matches isExportKind (sanity: enumeration below covers every supported kind)", () => {
    for (const kind of EXPORT_KINDS) expect(isExportKind(kind)).toBe(true);
    expect(EXPORT_KINDS.length).toBeGreaterThan(0);
  });

  for (const kind of EXPORT_KINDS) {
    it(`404s org B's organizer on org A's real eventId for kind '${kind}', with no data query executed`, async () => {
      const app = appWithDbAndAuth(fakeDbOwnershipOnly(EVENT_ORG_A), ORG_B_ORGANIZER);
      const res = await app.request(`/api/v1/events/${EVENT_ORG_A.id}/export/${kind}?format=csv`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_found");
    });
  }

  it("404s org B's organizer on org A's real eventId for the nonexistent-kind path (invalid kind never reaches ownership check either way)", async () => {
    const app = appWithDbAndAuth(fakeDbOwnershipOnly(EVENT_ORG_A), ORG_B_ORGANIZER);
    const res = await app.request(`/api/v1/events/does-not-exist/export/submissions?format=csv`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/events/:eventId/exports/showflow.csv — cross-org isolation (DEC-055 separate route)", () => {
  it("404s org B's organizer on org A's real eventId, with no data query executed", async () => {
    const app = appWithDbAndAuth(fakeDbOwnershipOnly(EVENT_ORG_A), ORG_B_ORGANIZER);
    const res = await app.request(`/api/v1/events/${EVENT_ORG_A.id}/exports/showflow.csv`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("404s for a nonexistent event", async () => {
    const app = appWithDbAndAuth(fakeDbOwnershipOnly(undefined), ORG_B_ORGANIZER);
    const res = await app.request(`/api/v1/events/does-not-exist/exports/showflow.csv`);
    expect(res.status).toBe(404);
  });
});

describe("nonexistent-event path (empty ownership lookup, distinct from a real cross-org row)", () => {
  it("404s GET /export/:kind for every kind when the event lookup returns no row", async () => {
    for (const kind of EXPORT_KINDS) {
      const app = appWithDbAndAuth(fakeDbOwnershipOnly(undefined), ORG_B_ORGANIZER);
      const res = await app.request(`/api/v1/events/does-not-exist/export/${kind}?format=csv`);
      expect(res.status).toBe(404);
    }
  });
});
