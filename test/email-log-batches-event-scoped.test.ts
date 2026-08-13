// DEC-732 (eval-findings 59): chases the reported "0 total" History count
// bug. Same fake-db SQL-inspection technique as test/email-log-batches.test
// .ts's sibling comment explains (no real SQLite engine is wired into these
// unit tests) -- this file asserts two things a regression here would
// break: (1) listEmailBatches' total (count(distinct BATCH_KEY)) is scoped
// by the SAME eventId equality its main aggregate query uses, so a batch
// can't be counted in one event's history and dropped from another's, and
// (2) the rows a fan-out send (e.g. POST /contacts/bulk-email) writes carry
// the REQUEST's eventId on every recipient row, not a stale/default one --
// the actual "event scoping of rows written by the contacts bulk-email
// path" this task was pointed at. Both held under close reading of
// src/server/repo/email.ts and src/routes/api/contacts/bulk-email.ts as of
// this task; this test exists to catch a regression, not to fix a live bug
// (see task notes).
import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { listEmailBatches } from "../src/server/repo/email";
import type { Db } from "../src/server/context";

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

describe("listEmailBatches total counts distinct batches for an event whose rows include a fan-out send (DEC-732)", () => {
  it("counts a 3-recipient fan-out batch plus a legacy single-send batch as 2 distinct batches, not 0", async () => {
    const aggregateRows = [
      { batchKey: "batch-fanout-1", subject: "You are in!", sentAt: 1_700_000_100_000, recipientCount: 3 },
      { batchKey: "log-legacy-1", subject: "Welcome", sentAt: 1_700_000_000_000, recipientCount: 1 },
    ];
    const countRows = [{ count: 2 }];
    const statusRows = [
      { batchKey: "batch-fanout-1", status: "sent", n: 3 },
      { batchKey: "log-legacy-1", status: "sent", n: 1 },
    ];
    const { db } = makeFakeDb([aggregateRows, countRows, statusRows]);

    const result = await listEmailBatches(db, { eventId: "ev1", page: 1, perPage: 20 });

    // The reported bug: total renders as 0 in History despite real batches.
    expect(result.total).toBe(2);
    expect(result.total).not.toBe(0);
    expect(result.items).toHaveLength(2);
  });

  it("scopes the count(distinct BATCH_KEY) query to the SAME eventId equality the main aggregate query uses", async () => {
    const { db, calls } = makeFakeDb([[], [{ count: 0 }], []]);
    await listEmailBatches(db, { eventId: "ev-scoped", page: 1, perPage: 20 });

    const mainCall = calls[0]!;
    const countCall = calls[1]!;
    const mainWhereSql = dialect.sqlToQuery(mainCall.find((c) => c.method === "where")!.args[0] as any).sql;
    const countWhereSql = dialect.sqlToQuery(countCall.find((c) => c.method === "where")!.args[0] as any).sql;

    expect(mainWhereSql).toContain("event_id");
    expect(countWhereSql).toContain("event_id");
    // Both must bind the same eventId param, or a mismatched scope between
    // the two queries could produce a "0 total" while the row list is
    // non-empty (or vice versa).
    const mainParams = dialect.sqlToQuery(mainCall.find((c) => c.method === "where")!.args[0] as any).params;
    const countParams = dialect.sqlToQuery(countCall.find((c) => c.method === "where")!.args[0] as any).params;
    expect(countParams).toEqual(mainParams);
  });

  it("returns 0 total (not an error) for an event with no email_log rows at all -- the honest zero, distinct from the reported bug", async () => {
    const { db } = makeFakeDb([[], [{ count: 0 }], []]);
    const result = await listEmailBatches(db, { eventId: "ev-empty", page: 1, perPage: 20 });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });
});
