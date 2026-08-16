// w41-a (DEC-027 wave-41 amendment, precedents DEC-649/DEC-671): the
// 'email-log' and 'evaluations' exports gain their own surfaces' filter
// vocabulary so an over-cap refusal names an action the caller can actually
// take, instead of a dead end.
//
// Same fake-db SQL-inspection technique as test/email-log-since-filter.test.ts
// and test/exports-submissions-filter.test.ts (no real SQLite engine wired
// into these unit tests): a chain double records the drizzle expressions
// passed to .where()/.orderBy()/etc, converted to literal SQL text via
// SQLiteSyncDialect for byte-identical comparison.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { listEmailLog } from "../src/server/repo/email";
import { exportEmailLog } from "../src/server/repo/exports/email-log";
import { exportEvaluations } from "../src/server/repo/exports/evaluations";
import { buildExport, EXPORT_MAX_ROWS } from "../src/server/repo/exports";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler, ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";

const dialect = new SQLiteSyncDialect();

function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  const calls: { method: string; args: unknown[] }[][] = [];
  function chain(): any {
    const log: { method: string; args: unknown[] }[] = [];
    calls.push(log);
    const obj: any = {};
    // "leftJoin" is here for the same reason "innerJoin" is: exportEvaluations
    // left-joins schema.contact (DEC-736 wave-79) so resolveReviewerIdentity
    // sees the organiser screen's row shape. The chain double must accept
    // every builder method the repo actually calls, or the query dies here
    // rather than in the code under test.
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select"];
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

describe("exportEmailLog honours the History tab's own filter via the shared predicate (w41-a)", () => {
  it("filtered export's WHERE clause is byte-identical to listEmailLog's row-query WHERE clause (one predicate, two surfaces)", async () => {
    const filter = { eventId: "event-1", contactId: "ct-1", status: "sent", q: "hello", batchKey: "batch-1", since: 1_700_000_000_000 };

    const { db: listDb, calls: listCalls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(listDb, { ...filter, page: 1, perPage: 20 });
    const listWhere = whereSqlOf(listCalls[0]!);

    const { db: exportDb, calls: exportCalls } = makeFakeDb([[]]);
    await exportEmailLog(exportDb, "event-1", { contactId: "ct-1", status: "sent", q: "hello", batchKey: "batch-1", since: 1_700_000_000_000 });
    const exportWhere = whereSqlOf(exportCalls[0]!);

    expect(exportWhere.sql).toBe(listWhere.sql);
    expect(exportWhere.params).toEqual(listWhere.params);
  });

  it("no params: WHERE clause matches listEmailLog's eventId-only filter", async () => {
    const { db: listDb, calls: listCalls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(listDb, { eventId: "event-1", page: 1, perPage: 20 });
    const listWhere = whereSqlOf(listCalls[0]!);

    const { db: exportDb, calls: exportCalls } = makeFakeDb([[]]);
    await exportEmailLog(exportDb, "event-1");
    const exportWhere = whereSqlOf(exportCalls[0]!);

    expect(exportWhere.sql).toBe(listWhere.sql);
    expect(exportWhere.params).toEqual(listWhere.params);
  });

  it("a filter that narrows the result set exports fine, well under the cap", async () => {
    const row = {
      sentAt: new Date("2026-01-01T00:00:00.000Z"),
      toEmail: "a@example.com",
      subject: "Hello",
      status: "sent",
      templateId: "tpl-1",
      id: "log-1",
    };
    const { db } = makeFakeDb([[row]]);
    const table = await exportEmailLog(db, "event-1", { status: "sent" });
    expect(table.truncated).toBe(false);
    expect(table.rows).toEqual([["2026-01-01T00:00:00.000Z", "a@example.com", "Hello", "sent", "tpl-1"]]);
  });
});

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

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };
const EVENT_ROW = { id: "event-1", orgId: "org-1" };
const OVERFLOW_ROWS = Array.from({ length: EXPORT_MAX_ROWS + 1 }, () => ({}));

describe("GET .../export/email-log over-cap refusal names its filter params (w41-a)", () => {
  it("names status/q/batchId/since/contactId, not a dead end", async () => {
    const { db } = makeFakeDb([[EVENT_ROW], OVERFLOW_ROWS]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/export/email-log?format=csv");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/status/i);
    expect(body.error.message).toMatch(/q\b/);
    expect(body.error.message).toMatch(/batchId/i);
    expect(body.error.message).toMatch(/since/i);
    expect(body.error.message).toMatch(/contactId/i);
  });

  it("an unrecognised status value 400s using the SAME validator the history route uses", async () => {
    const { db } = makeFakeDb([[EVENT_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/export/email-log?status=bogus&format=csv");
    expect(res.status).toBe(400);
  });
});

describe("GET .../export/evaluations over-cap refusal names planId/round (w41-a)", () => {
  it("names planId and round, not a dead end", async () => {
    const { db } = makeFakeDb([[EVENT_ROW], [{ recordPrefix: "SES" }], OVERFLOW_ROWS]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/export/evaluations?format=csv");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/planId/i);
    expect(body.error.message).toMatch(/round/i);
  });

  it("a round narrowing the result set exports fine, well under the cap", async () => {
    const { db } = makeFakeDb([[EVENT_ROW], [{ recordPrefix: "SES" }], []]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/export/evaluations?round=1&format=csv");
    expect(res.status).toBe(200);
  });

  it("round must be a positive integer", async () => {
    const { db } = makeFakeDb([[EVENT_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/export/evaluations?round=0&format=csv");
    expect(res.status).toBe(400);
  });
});

describe("exportEvaluations: a foreign/unknown planId is a loud error, never a silently empty CSV (w41-a)", () => {
  it("throws ApiError('invalid') naming the planId field when the plan does not belong to this event", async () => {
    // getRecordPrefix's select, then the ownership-check select (returns no
    // matching row -- the plan belongs to a different event, or doesn't
    // exist at all).
    const { db } = makeFakeDb([[{ recordPrefix: "SES" }], []]);
    await expect(exportEvaluations(db, "event-1", { planId: "plan-from-another-event" })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("the thrown error's fields name planId", async () => {
    const { db } = makeFakeDb([[{ recordPrefix: "SES" }], []]);
    try {
      await exportEvaluations(db, "event-1", { planId: "plan-x" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.fields).toHaveProperty("planId");
    }
  });

  it("a known planId of this event proceeds to the main query (no error)", async () => {
    const { db } = makeFakeDb([[{ recordPrefix: "SES" }], [{ id: "plan-1" }], []]);
    const table = await exportEvaluations(db, "event-1", { planId: "plan-1" });
    expect(table.truncated).toBe(false);
    expect(table.rows).toEqual([]);
  });
});

describe("buildExport threads emailLogParams/evaluationsParams through unchanged for other kinds", () => {
  it("submissions/contacts/speakers/agenda/showflow behaviour is untouched by the new optional params", async () => {
    const { db } = makeFakeDb([[{ recordPrefix: "SES" }], []]);
    const table = await buildExport(db, "event-1", "speakers");
    expect(table.rows).toEqual([]);
  });
});
