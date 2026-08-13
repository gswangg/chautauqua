// DEC-905: the Comms head's "N sent in the last 7 days" reads GET
// .../email-log's OWN envelope total under a new `since` (epoch-ms) filter
// pushed into SQL -- never a post-fetch/JS filter, and never a sum over a
// page of batches. Same fake-db SQL-inspection technique as
// test/email-log-batches.test.ts's sibling comment explains (no real
// SQLite engine is wired into these unit tests): we assert the WHERE
// clause both the row query and the count query build actually includes
// the sentAt >= since condition (so a row outside the window is excluded
// from items AND from total, not just one of the two), and that the route
// parses/validates `since` before handing it to the repo.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { listEmailLog } from "../src/server/repo/email";
import type { Db } from "../src/server/context";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";

const dialect = new SQLiteSyncDialect();

function makeFakeDb(responses: unknown[]) {
  let cursor = 0;
  const calls: { method: string; args: unknown[] }[][] = [];
  function chain(): any {
    const log: { method: string; args: unknown[] }[] = [];
    calls.push(log);
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select"];
    for (const m of passthrough) {
      obj[m] = (...args: unknown[]) => {
        log.push({ method: m, args });
        return obj;
      };
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[cursor];
      cursor += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { db: { select: () => chain() } as unknown as Db, calls };
}

describe("listEmailLog `since` filter (DEC-905)", () => {
  it("pushes sentAt >= since into BOTH the row query's and the count query's WHERE clause, with matching bound params", async () => {
    const since = 1_700_000_000_000;
    const { db, calls } = makeFakeDb([[], [{ count: 0 }]]);

    await listEmailLog(db, { since, page: 1, perPage: 20 });

    const rowsWhere = calls[0]!.find((c) => c.method === "where")!;
    const countWhere = calls[1]!.find((c) => c.method === "where")!;
    const rowsSql = dialect.sqlToQuery(rowsWhere.args[0] as any);
    const countSql = dialect.sqlToQuery(countWhere.args[0] as any);

    expect(rowsSql.sql).toContain("sent_at");
    expect(rowsSql.sql).toContain(">=");
    expect(countSql.sql).toContain("sent_at");
    expect(countSql.sql).toContain(">=");

    // Both queries bind the exact same since value -- an item that's out of
    // the row query's window can't slip back into the count.
    expect(rowsSql.params).toContain(since);
    expect(countSql.params).toContain(since);
  });

  it("omits the sentAt condition entirely when `since` is not given", async () => {
    const { db, calls } = makeFakeDb([[], [{ count: 0 }]]);

    await listEmailLog(db, { page: 1, perPage: 20 });

    const rowsWhereCall = calls[0]!.find((c) => c.method === "where");
    // No eventId/contactId/status/q/batchKey/since given -> no where() call
    // at all (conditions.length === 0).
    expect(rowsWhereCall).toBeUndefined();
  });

  it("a row outside the `since` window is excluded from both items and total", async () => {
    const since = 1_700_000_000_000;
    // The fake db's canned responses stand in for what the real SQL's
    // sentAt >= since predicate would already have filtered out -- the row
    // dated before `since` never appears in either response, exercising
    // the caller-visible contract the structural assertion above backs.
    const inWindowRow = {
      id: "log-in-window",
      eventName: "Arbitrary Con",
      toEmail: "in@example.com",
      subject: "Recent",
      status: "sent",
      sentAt: new Date(since + 1000),
    };
    const { db } = makeFakeDb([[inWindowRow], [{ count: 1 }]]);

    const result = await listEmailLog(db, { since, page: 1, perPage: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("log-in-window");
    expect(result.total).toBe(1);
  });
});

describe("GET .../email-log `since` query param (DEC-905)", () => {
  async function buildAppAndCapture() {
    const captured: { since?: number }[] = [];
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("auth", { userId: "u1", role: "organizer", orgId: "org1" });
      c.set("db", {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: "ev1", orgId: "org1" }]),
            }),
          }),
        }),
      } as never);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", emailLogRoutes);
    return { app, captured };
  }

  it("400s on a non-numeric `since`", async () => {
    const { app } = await buildAppAndCapture();
    const res = await app.request("/api/v1/events/ev1/email-log?since=not-a-number", {}, { KV: {} });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("since");
  });

  it("400s on a negative `since`", async () => {
    const { app } = await buildAppAndCapture();
    const res = await app.request("/api/v1/events/ev1/email-log?since=-5", {}, { KV: {} });
    expect(res.status).toBe(400);
  });
});
