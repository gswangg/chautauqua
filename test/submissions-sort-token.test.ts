// DEC-843 (task w62-g): the submissions list and its CSV/JSON export must
// read the `sort` query token through the SAME loud reader (readSortToken,
// src/server/repo/submissions/query.ts) instead of parseListQuery's old
// silent fallback to 'newest' for any unrecognised value. This mirrors
// test/submissions-status-parity.test.ts's technique: drive the real route
// apps with fake dbs, and assert an unknown `sort` token 400s (naming the
// token) on both surfaces rather than silently reordering the export.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler } from "../src/server/http";
import { readSortToken } from "../src/server/repo/submissions/query";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ID = "event-1";
const ORG_ID = "org-1";
const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_ID };

// Same fake db recorder as test/submissions-status-parity.test.ts.
function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  function chain(): any {
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) obj[m] = (..._args: unknown[]) => obj;
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[cursor];
      cursor += 1;
      if (value === undefined) {
        return Promise.reject(new Error(`fake db: no queued response for query #${cursor}`)).catch(
          (e) => (reject ? reject(e) : Promise.reject(e)),
        );
      }
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { select: () => chain() } as unknown as AppEnv["Variables"]["db"];
}

function listDbFor() {
  // ownership: getEventOrgId -> [{orgId}]
  return makeFakeDb([[{ orgId: ORG_ID }]]);
}

function exportDbFor() {
  // requireOwnedEvent -> [{id,orgId}]
  return makeFakeDb([[{ id: EVENT_ID, orgId: ORG_ID }]]);
}

function listApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", AUTH);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

function exportApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", AUTH);
    await next();
  });
  app.route("/", exportsRoutes);
  return app;
}

describe("readSortToken (DEC-843, w62 amendment)", () => {
  it("absent/empty resolves to the documented default 'newest'", () => {
    expect(readSortToken(undefined)).toBe("newest");
    expect(readSortToken("")).toBe("newest");
    expect(readSortToken("  ")).toBe("newest");
  });

  it("accepts every documented SORT_ORDERS token, trimmed", () => {
    expect(readSortToken("oldest")).toBe("oldest");
    expect(readSortToken(" title ")).toBe("title");
    expect(readSortToken("ref")).toBe("ref");
    expect(readSortToken("worklist")).toBe("worklist");
  });

  it("throws naming the token for anything outside SORT_ORDERS", () => {
    expect(() => readSortToken("score")).toThrow("score");
    expect(() => readSortToken("Newest")).toThrow("Newest");
  });
});

describe("GET .../submissions?sort=<unknown> 400s in the standard envelope (DEC-843)", () => {
  it("400s naming the unrecognised token instead of silently falling back to 'newest'", async () => {
    const res = await listApp(listDbFor()).request(
      `/api/v1/events/${EVENT_ID}/submissions?sort=score`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBeTruthy();
    expect(body.error.message).toContain("score");
  });
});

describe("CSV export at kind=submissions 400s on an unrecognised sort token (DEC-843)", () => {
  it("400s naming the unrecognised token via the same try/catch the status filter uses", async () => {
    const res = await exportApp(exportDbFor()).request(
      `/api/v1/events/${EVENT_ID}/export/submissions?format=csv&sort=score`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBeTruthy();
    expect(body.error.message).toContain("score");
  });
});
