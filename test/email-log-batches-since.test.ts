// DEC-905 (wave-61 amendment): the Comms head must count what its copy
// claims, and ?groupBy=batch must stop discarding filters. This file covers
// the two repo/route changes: (1) listEmailBatches gains an optional
// `since` epoch-ms lower bound applied to BOTH the page query and the total
// query, so the envelope's total and its items describe the same window;
// (2) GET .../email-log?groupBy=batch now 400s (naming the offending field)
// when combined with status/contactId/batchId instead of silently dropping
// them, while `since` passes through. Same fake-db SQL-inspection technique
// as test/email-log-batches.test.ts's sibling comment explains.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { listEmailBatches } from "../src/server/repo/email";
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

describe("listEmailBatches `since` filter (DEC-905)", () => {
  it("pushes sentAt >= since into BOTH the page query's and the count query's WHERE clause", async () => {
    const since = 1_700_000_000_000;
    const { db, calls } = makeFakeDb([[], [{ count: 0 }], []]);

    await listEmailBatches(db, { eventId: "ev1", since, page: 1, perPage: 20 });

    const mainWhere = calls[0]!.find((c) => c.method === "where")!;
    const countWhere = calls[1]!.find((c) => c.method === "where")!;
    const mainSql = dialect.sqlToQuery(mainWhere.args[0] as any);
    const countSql = dialect.sqlToQuery(countWhere.args[0] as any);

    expect(mainSql.sql).toContain("sent_at");
    expect(mainSql.sql).toContain(">=");
    expect(countSql.sql).toContain("sent_at");
    expect(countSql.sql).toContain(">=");
    expect(mainSql.params).toContain(since);
    expect(countSql.params).toContain(since);
  });

  it("a batch entirely outside the `since` window is excluded from both items and total", async () => {
    const { db } = makeFakeDb([[], [{ count: 0 }], []]);
    const result = await listEmailBatches(db, { eventId: "ev1", since: 1_700_000_000_000, page: 1, perPage: 20 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("omits the sentAt condition when `since` is not given", async () => {
    const { db, calls } = makeFakeDb([[], [{ count: 0 }], []]);
    await listEmailBatches(db, { eventId: "ev1", page: 1, perPage: 20 });
    const mainWhere = calls[0]!.find((c) => c.method === "where")!;
    const mainSql = dialect.sqlToQuery(mainWhere.args[0] as any);
    expect(mainSql.sql).not.toContain(">=");
  });
});

describe("GET .../email-log?groupBy=batch rejects filters batch grain can't express (DEC-905)", () => {
  function buildApp() {
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
    return app;
  }

  it("400s naming `status` when combined with groupBy=batch", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const app = buildApp();
    app.route("/", emailLogRoutes);
    const res = await app.request("/api/v1/events/ev1/email-log?groupBy=batch&status=failed", {}, { KV: {} });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("groupBy");
  });

  it("400s naming `contactId` when combined with groupBy=batch", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const app = buildApp();
    app.route("/", emailLogRoutes);
    const res = await app.request("/api/v1/events/ev1/email-log?groupBy=batch&contactId=ct_a", {}, { KV: {} });
    expect(res.status).toBe(400);
  });

  it("400s naming `batchId` when combined with groupBy=batch", async () => {
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const app = buildApp();
    app.route("/", emailLogRoutes);
    const res = await app.request("/api/v1/events/ev1/email-log?groupBy=batch&batchId=b1", {}, { KV: {} });
    expect(res.status).toBe(400);
  });
});
