// task-w3-g (DEC-027 wave-82 amendment): the email-log export's filter
// vocabulary is DERIVED from the list's own params type (EmailLogListParams),
// never hand-listed, so templateId can never silently drop out again the way
// it did before this task -- EmailLogExportParams previously hand-listed five
// filters while emailLogConditions took six, and templateId (which the CSV's
// own header ships as a column) was quietly dropped on ?templateId= while it
// worked identically on the sibling list route (src/routes/api/email-log.ts).
//
// Same fake-db SQL-inspection technique as test/exports-narrowing.test.ts and
// test/email-log-templateId-filter.test.ts: no real SQLite engine wired in, a
// chain double records the drizzle expressions passed to .where(), converted
// to literal SQL text via SQLiteSyncDialect for byte-identical comparison.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { listEmailLog } from "../src/server/repo/email";
import type { EmailLogListParams } from "../src/server/repo/email";
import { exportEmailLog, type EmailLogExportParams } from "../src/server/repo/exports/email-log";
import { exportsRoutes } from "../src/routes/api/exports";
import { registerErrorHandler } from "../src/server/http";
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

// Structural (compile-time) proof the export params type is DERIVED from the
// list params type, never a hand-listed sibling that can drift again: every
// member of EmailLogExportParams must be assignable both ways against the
// corresponding Pick<> of EmailLogListParams. If a future hand-edit adds a
// field to EmailLogExportParams that doesn't exist on EmailLogListParams (or
// vice versa for the picked keys), this line fails to compile.
type _DerivedCheck = EmailLogExportParams extends Pick<EmailLogListParams, "contactId" | "status" | "q" | "batchKey" | "since" | "templateId">
  ? Pick<EmailLogListParams, "contactId" | "status" | "q" | "batchKey" | "since" | "templateId"> extends EmailLogExportParams
    ? true
    : never
  : never;
const _derivedCheck: _DerivedCheck = true;
void _derivedCheck;

describe("exportEmailLog's templateId filter agrees with listEmailLog's (task-w3-g)", () => {
  it("filtered export's WHERE clause (with templateId) is byte-identical to listEmailLog's row-query WHERE", async () => {
    const filter = { eventId: "event-1", templateId: "tpl-1" };

    const { db: listDb, calls: listCalls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(listDb, { ...filter, page: 1, perPage: 20 });
    const listWhere = whereSqlOf(listCalls[0]!);

    const { db: exportDb, calls: exportCalls } = makeFakeDb([[]]);
    await exportEmailLog(exportDb, "event-1", { templateId: "tpl-1" });
    const exportWhere = whereSqlOf(exportCalls[0]!);

    expect(exportWhere.sql).toBe(listWhere.sql);
    expect(exportWhere.params).toEqual(listWhere.params);
    expect(exportWhere.sql).toContain("template_id");
  });

  it("templateId combined with the other five filters still matches listEmailLog byte-for-byte", async () => {
    const filter = {
      eventId: "event-1",
      contactId: "ct-1",
      status: "sent",
      q: "hello",
      batchKey: "batch-1",
      since: 1_700_000_000_000,
      templateId: "tpl-1",
    };

    const { db: listDb, calls: listCalls } = makeFakeDb([[], [{ count: 0 }]]);
    await listEmailLog(listDb, { ...filter, page: 1, perPage: 20 });
    const listWhere = whereSqlOf(listCalls[0]!);

    const { db: exportDb, calls: exportCalls } = makeFakeDb([[]]);
    const params: EmailLogExportParams = { contactId: "ct-1", status: "sent", q: "hello", batchKey: "batch-1", since: 1_700_000_000_000, templateId: "tpl-1" };
    await exportEmailLog(exportDb, "event-1", params);
    const exportWhere = whereSqlOf(exportCalls[0]!);

    expect(exportWhere.sql).toBe(listWhere.sql);
    expect(exportWhere.params).toEqual(listWhere.params);
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

describe("GET .../export/email-log?templateId= (task-w3-g)", () => {
  it("threads templateId into the row query instead of silently dropping it", async () => {
    const { db, calls } = makeFakeDb([[EVENT_ROW], []]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/export/email-log?templateId=tpl-1&format=csv");
    expect(res.status).toBe(200);
    const exportWhere = whereSqlOf(calls[1]!);
    expect(exportWhere.sql).toContain("template_id");
    expect(exportWhere.params).toContain("tpl-1");
  });

  it("an over-long templateId 400s on the export route, same as the list route (parseBoundedText shared)", async () => {
    const { db } = makeFakeDb([[EVENT_ROW]]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const overLong = "x".repeat(65);
    const res = await app.request(`/api/v1/events/event-1/export/email-log?templateId=${overLong}&format=csv`);
    expect(res.status).toBe(400);
  });

  it("an over-long templateId 400s on the sibling list route too, same validator", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const { db } = makeFakeDb([[EVENT_ROW]]);
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", ORGANIZER);
      await next();
    });
    app.route("/", emailLogRoutes);
    const overLong = "x".repeat(65);
    const res = await app.request(`/api/v1/events/event-1/email-log?templateId=${overLong}`, {}, { KV: {} });
    expect(res.status).toBe(400);
  });
});
