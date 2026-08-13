// DEC-649 (task w9-e): the submissions export honours the list's filter
// through the SAME where clause. src/server/repo/submissions/list.ts's
// inline WHERE construction (eventId + status + contentStatus + the
// correlated q/trackId EXISTS subqueries) is extracted into
// `submissionListConditions`, which listSubmissions and exportSubmissions
// both call — so this test asserts (a) the exact SQL text + bound params
// captured off each function's main select call are byte-identical for a
// status filter, a q filter, and a trackId filter, and (b) exportSubmissions'
// unpaginated row count equals listSubmissions' server-side `total` for the
// same params. No real SQLite engine is wired into these unit tests (see
// test/content-worklist-server-driven.test.ts's sibling comment) — both
// repo functions are exercised against a fake db double that records the
// drizzle SQL passed to .where()/.orderBy(), converted to literal text via
// SQLiteSyncDialect for comparison (same technique as
// test/email-log-batches.test.ts / test/content-worklist-server-driven.test.ts).

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { eq, asc } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { listSubmissions } from "../src/server/repo/submissions/list";
import { exportSubmissions } from "../src/server/repo/exports/submissions";
import type { ParsedListQuery } from "../src/server/repo/submissions/query";

const dialect = new SQLiteSyncDialect();
const EVENT_ID = "event-1";

function baseParams(overrides: Partial<ParsedListQuery> = {}): ParsedListQuery {
  return {
    page: 1,
    perPage: 50,
    q: null,
    status: [],
    contentStatus: [],
    trackId: null,
    sort: "newest",
    includeAnswers: false,
    reuploaded: null,
    ...overrides,
  };
}

function submissionRow(id: string, seq: number, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title,
    seq,
    createdAt: new Date(2026, 0, seq),
    updatedAt: new Date(2026, 0, seq),
    eventId: EVENT_ID,
    description: null,
    formId: null,
    trackId: null,
    additionalTrackIdsJson: null,
    status: "accepted",
    contentStatus: "pending",
    acceptedAt: null,
    icsSequence: 0,
    ...overrides,
  };
}

// Same fake db recorder pattern as test/content-worklist-server-driven.test.ts:
// each queued response array is consumed in order by the next `select()`
// chain's resolution; .where()/.orderBy()/etc calls on that chain are
// recorded so tests can inspect the exact drizzle expressions passed.
function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  const calls: { method: string; args: unknown[] }[][] = [];
  function chain(): any {
    const thisCallLog: { method: string; args: unknown[] }[] = [];
    calls.push(thisCallLog);
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) {
      obj[m] = (...args: unknown[]) => {
        thisCallLog.push({ method: m, args });
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
  return { select: () => chain(), calls } as any;
}

function whereSqlOf(callLog: { method: string; args: unknown[] }[]) {
  const whereCall = callLog.find((c) => c.method === "where");
  expect(whereCall).toBeDefined();
  return dialect.sqlToQuery(whereCall!.args[0] as any);
}

function orderBySqlOf(callLog: { method: string; args: unknown[] }[]) {
  const orderByCall = callLog.find((c) => c.method === "orderBy");
  expect(orderByCall).toBeDefined();
  return dialect.sqlToQuery(orderByCall!.args[0] as any);
}

// listSubmissions' response queue: event prefix, count, DEC-913 grouped
// counts, page rows, participants, tracks, deliverable counts, latestFile
// candidates (matches test/content-worklist-server-driven.test.ts's
// ordering).
function listResponses(rows: unknown[], total: number) {
  return [[{ recordPrefix: "SES" }], [{ count: total }], [], rows, [], [], [], [], []];
}

// exportSubmissions' response queue: recordPrefix, submissions (unpaginated,
// ALL matching rows), track joins, participants, forms, answers (0 field
// batches since formIds is empty here — matches src/server/repo/exports/
// submissions.ts's query order).
function exportResponses(rows: unknown[]) {
  return [[{ recordPrefix: "SES" }], rows, [], [], [], []];
}

async function assertSameFilter(
  label: string,
  params: ParsedListQuery,
  matchingRows: ReturnType<typeof submissionRow>[],
  pageSize: number,
) {
  // listSubmissions: only `pageSize` rows come back on the page, but total
  // reports every matching row (server-side count) — same as the real
  // contract the pagination tests above exercise.
  const listDb = makeFakeDb(listResponses(matchingRows.slice(0, pageSize), matchingRows.length));
  const listResult = await listSubmissions(listDb, EVENT_ID, { ...params, perPage: pageSize });

  // exportSubmissions: unpaginated, so it returns every matching row.
  const exportDb = makeFakeDb(exportResponses(matchingRows));
  const table = await exportSubmissions(exportDb, EVENT_ID, params);

  // (a) exported row count equals listSubmissions' total for identical params.
  expect(table.rows.length, `${label}: export row count vs list total`).toBe(listResult.total);

  // (b) the WHERE clause each function's main select ran is byte-identical
  // (same SQL text, same bound params) — the export used the SAME
  // submissionListConditions the list used, not a hand-copied filter.
  const listWhere = whereSqlOf(listDb.calls[3]!);
  const exportWhere = whereSqlOf(exportDb.calls[1]!);
  expect(exportWhere.sql, `${label}: WHERE SQL text`).toBe(listWhere.sql);
  expect(exportWhere.params, `${label}: WHERE bound params`).toEqual(listWhere.params);

  // orderBy also matches (same orderByForSort(params.sort)).
  const listOrder = orderBySqlOf(listDb.calls[3]!);
  const exportOrder = orderBySqlOf(exportDb.calls[1]!);
  expect(exportOrder.sql, `${label}: ORDER BY SQL text`).toBe(listOrder.sql);
}

describe("exportSubmissions honours the list's filter via the shared WHERE clause (DEC-649)", () => {
  it("status filter: export row count == list total, WHERE/ORDER BY identical", async () => {
    const rows = [
      submissionRow("s1", 1, "Alpha", { status: "accepted" }),
      submissionRow("s2", 2, "Beta", { status: "accepted" }),
      submissionRow("s3", 3, "Gamma", { status: "accepted" }),
    ];
    await assertSameFilter("status filter", baseParams({ status: ["accepted"] }), rows, 2);
  });

  it("q filter: export row count == list total, WHERE/ORDER BY identical", async () => {
    const rows = [
      submissionRow("s1", 1, "Machine Learning Talk"),
      submissionRow("s2", 2, "Machine Vision Talk"),
    ];
    await assertSameFilter("q filter", baseParams({ q: "machine" }), rows, 1);
  });

  it("trackId filter: export row count == list total, WHERE/ORDER BY identical", async () => {
    const rows = [
      submissionRow("s1", 1, "Track Talk One", { trackId: "trk-1" }),
      submissionRow("s2", 2, "Track Talk Two", { trackId: "trk-1" }),
      submissionRow("s3", 3, "Track Talk Three", { trackId: "trk-1" }),
      submissionRow("s4", 4, "Track Talk Four", { trackId: "trk-1" }),
    ];
    await assertSameFilter("trackId filter", baseParams({ trackId: "trk-1" }), rows, 3);
  });

  it("no params: exportSubmissions behaves exactly as before (eq(eventId) + asc(seq), unpaginated)", async () => {
    const rows = [
      submissionRow("s1", 1, "First"),
      submissionRow("s2", 2, "Second"),
      submissionRow("s3", 3, "Third"),
    ];
    const db = makeFakeDb(exportResponses(rows));
    const table = await exportSubmissions(db, EVENT_ID);

    expect(table.rows).toHaveLength(3);

    const submissionsCall = db.calls[1]!;
    const { sql, params } = whereSqlOf(submissionsCall);
    const expectedWhere = dialect.sqlToQuery(eq(schema.submission.eventId, EVENT_ID) as any);
    expect(sql).toBe(expectedWhere.sql);
    expect(params).toEqual(expectedWhere.params);

    const order = orderBySqlOf(submissionsCall);
    const expectedOrder = dialect.sqlToQuery(asc(schema.submission.seq) as any);
    expect(order.sql).toBe(expectedOrder.sql);
  });
});
