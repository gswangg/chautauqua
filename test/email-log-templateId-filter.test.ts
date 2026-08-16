// DEC-603 (wave-56 amendment): the Comms History tab's template chip row
// filters on `?templateId=`, pushed into the SAME shared predicate builders
// (emailLogConditions/batchWhere) the flat list, the batch grouping, and the
// J12 email-log export already share -- never a post-fetch filter, and never
// a second templateId-specific function. Unlike DEC-905's status/contactId/
// batchId, templateId IS expressible at batch grain (listEmailBatches
// already projects it via MIN()), so ?groupBy=batch&templateId= must NOT
// 400 the way those three do.
//
// Same fake-db SQL-inspection technique as test/email-log-batches-since.test.ts
// and test/exports-narrowing.test.ts: no real SQLite engine wired in, a
// chain double records the drizzle expressions passed to .where(), converted
// to literal SQL text via SQLiteSyncDialect for byte-identical comparison.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { listEmailBatches, listEmailLog } from "../src/server/repo/email";
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
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
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

function whereSqlOf(callLog: { method: string; args: unknown[] }[]) {
  const whereCall = callLog.find((c) => c.method === "where");
  expect(whereCall).toBeDefined();
  return dialect.sqlToQuery(whereCall!.args[0] as any);
}

describe("templateId filter agrees between flat grain and batch grain (DEC-603)", () => {
  it("listEmailLog's row-query WHERE pushes templateId into SQL, never a post-fetch filter", async () => {
    const { db, calls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(db, { eventId: "ev1", templateId: "tpl-1", page: 1, perPage: 20 });
    const where = whereSqlOf(calls[0]!);
    expect(where.sql).toContain("template_id");
    expect(where.params).toContain("tpl-1");
  });

  it("listEmailBatches' page query AND its count query both push templateId into SQL", async () => {
    const { db, calls } = makeFakeDb([[], [{ count: 0 }], []]);
    await listEmailBatches(db, { eventId: "ev1", templateId: "tpl-1", page: 1, perPage: 20 });
    const mainWhere = whereSqlOf(calls[0]!);
    const countWhere = whereSqlOf(calls[1]!);
    expect(mainWhere.sql).toContain("template_id");
    expect(mainWhere.params).toContain("tpl-1");
    expect(countWhere.sql).toContain("template_id");
    expect(countWhere.params).toContain("tpl-1");
  });

  it("flat grain's templateId WHERE fragment is byte-identical to batch grain's own", async () => {
    const { db: flatDb, calls: flatCalls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(flatDb, { eventId: "ev1", templateId: "tpl-1", page: 1, perPage: 20 });
    const flatWhere = whereSqlOf(flatCalls[0]!);

    const { db: batchDb, calls: batchCalls } = makeFakeDb([[], [{ count: 0 }], []]);
    await listEmailBatches(batchDb, { eventId: "ev1", templateId: "tpl-1", page: 1, perPage: 20 });
    const batchWhereSql = whereSqlOf(batchCalls[0]!);

    // Both predicates are `eventId = ? AND templateId = ?` (batchWhere always
    // includes eventId; emailLogConditions includes it too since it's given)
    // -- same clauses, same params, same order.
    expect(batchWhereSql.sql).toBe(flatWhere.sql);
    expect(batchWhereSql.params).toEqual(flatWhere.params);
  });

  it("omits the templateId condition when not given", async () => {
    const { db, calls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(db, { eventId: "ev1", page: 1, perPage: 20 });
    const where = whereSqlOf(calls[0]!);
    expect(where.sql).not.toContain("template_id");
  });
});

describe("GET .../email-log?groupBy=batch&templateId= is NOT refused (templateId IS expressible at batch grain)", () => {
  function buildApp(db: Db) {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("auth", { userId: "u1", role: "organizer", orgId: "org1" });
      c.set("db", db as never);
      await next();
    });
    registerErrorHandler(app);
    return app;
  }

  it("200s and passes templateId through, unlike status/contactId/batchId", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    // Responses, in call order: (1) the event-ownership lookup, (2) the
    // batch page query, (3) the batch count query. items=[] so the
    // per-batch status-tally loop never fires a 4th query.
    const { db, calls } = makeFakeDb([[{ id: "ev1", orgId: "org1" }], [], [{ count: 0 }]]);
    const app = buildApp(db);
    app.route("/", emailLogRoutes);
    const res = await app.request("/api/v1/events/ev1/email-log?groupBy=batch&templateId=tpl-1", {}, { KV: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");

    const batchPageWhere = whereSqlOf(calls[1]!);
    expect(batchPageWhere.sql).toContain("template_id");
    expect(batchPageWhere.params).toContain("tpl-1");
  });
});
