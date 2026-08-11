// DEC-341: the J8 content worklist is server-driven — the tab (contentStatus)
// filter and the worklist priority sort are applied in the WHERE/ORDER BY of
// listSubmissions' one paginated statement (DEC-335), not by the SPA
// re-filtering/re-sorting a single fetched page. Exercises the repo function
// against a fake db double that records the drizzle SQL expressions passed
// to .where()/.orderBy() (same fakeDb-recorder pattern as
// test/api-submissions.test.ts's "one paginated statement" suite), and
// converts them to literal SQL text via SQLiteSyncDialect for assertions —
// there's no real SQLite engine wired into these unit tests (stage-1 uses a
// fake db double throughout, not a wrangler/D1 dependency).
import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { listSubmissions } from "../src/server/repo/submissions/list";
import type { ParsedListQuery } from "../src/server/repo/submissions/query";

const dialect = new SQLiteSyncDialect();

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
    ...overrides,
  };
}

function makeFakeDb(responses: unknown[]) {
  let cursor = 0;
  const calls: { method: string; args: unknown[] }[][] = [];
  function chain(): any {
    const thisCallLog: { method: string; args: unknown[] }[] = [];
    calls.push(thisCallLog);
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
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

const EVENT_ID = "event-1";

function submissionRow(id: string, seq: number, title: string) {
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
  };
}

describe("listSubmissions contentStatus filter (DEC-341)", () => {
  it("pushes contentStatus into the page-query WHERE as an inArray on content_status", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 3 }],
      [submissionRow("sub-1", 1, "Talk One")],
      [], // participants
      [], // tracks
      [], // deliverable counts
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams({ contentStatus: ["changes_requested"] }));

    // Call index 2 is the page query (0: event prefix, 1: count, 2: page).
    const pageCallLog = db.calls[2]!;
    const whereCall = pageCallLog.find((c: { method: string }) => c.method === "where");
    expect(whereCall).toBeDefined();
    const { sql, params } = dialect.sqlToQuery(whereCall!.args[0] as any);
    expect(sql).toContain('"submission"."content_status" in');
    expect(params).toContain("changes_requested");
  });

  it("total is the server-side count, unaffected by how many rows landed on this page — stays correct across pages", async () => {
    // Page 1: count says 137 total matches, but only 50 rows come back on
    // this page (a realistic slice) — total must report 137, not 50.
    const page1Responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 137 }],
      Array.from({ length: 50 }, (_, i) => submissionRow(`sub-${i}`, i, `Talk ${i}`)),
      [],
      [],
      [],
    ];
    const db1 = makeFakeDb(page1Responses);
    const page1 = await listSubmissions(
      db1,
      EVENT_ID,
      baseParams({ contentStatus: ["changes_requested"], page: 1, perPage: 50 }),
    );
    expect(page1.total).toBe(137);
    expect(page1.items).toHaveLength(50);

    // Page 3 (last, partial): same event-wide total, fewer rows on the page.
    const page3Responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 137 }],
      Array.from({ length: 37 }, (_, i) => submissionRow(`sub-p3-${i}`, 100 + i, `Talk P3 ${i}`)),
      [],
      [],
      [],
    ];
    const db3 = makeFakeDb(page3Responses);
    const page3 = await listSubmissions(
      db3,
      EVENT_ID,
      baseParams({ contentStatus: ["changes_requested"], page: 3, perPage: 50 }),
    );
    expect(page3.total).toBe(137);
    expect(page3.items).toHaveLength(37);
  });
});

describe("listSubmissions sort=worklist (DEC-341)", () => {
  it("orders changes_requested before pending before approved, with a title then seq tiebreaker", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams({ sort: "worklist" }));

    const pageCallLog = db.calls[2]!;
    const orderByCall = pageCallLog.find((c: { method: string }) => c.method === "orderBy");
    expect(orderByCall).toBeDefined();
    const { sql } = dialect.sqlToQuery(orderByCall!.args[0] as any);
    // Priority CASE first (changes_requested=0, pending=1, else=2), then
    // title asc, then seq asc as the stable-paging tiebreaker (DEC-335).
    expect(sql).toMatch(/case\s+"submission"\."content_status"/i);
    expect(sql).toContain("'changes_requested' then 0");
    expect(sql).toContain("'pending' then 1");
    expect(sql.indexOf("case")).toBeLessThan(sql.indexOf('"submission"."title" asc'));
    expect(sql.indexOf('"submission"."title" asc')).toBeLessThan(sql.indexOf('"submission"."seq" asc'));
  });
});

describe("listSubmissions deliverableCounts (DEC-341 hydration, DEC-247 chain roots)", () => {
  it("scopes the per-page deliverable-count query to chain roots (previous_file_id is null) among the three deliverable kinds", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }],
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams());

    // Deliverable-count query is the 6th select() call (index 5).
    const deliverableCallLog = db.calls[5]!;
    const whereCall = deliverableCallLog.find((c: { method: string }) => c.method === "where");
    expect(whereCall).toBeDefined();
    const { sql } = dialect.sqlToQuery(whereCall!.args[0] as any);
    expect(sql).toContain('"file"."previous_file_id" is null');
    expect(sql).toMatch(/"file"\."kind" in/);
  });

  it("reports the server-hydrated chain-root count and defaults absent kinds to 0", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      // Only a presentation chain-root row comes back — a file whose
      // previous_file_id is set would never appear here (excluded by the
      // WHERE, not filtered client-side), and poster/handout have none.
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }],
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.deliverableCounts).toEqual({ presentation: 1, poster: 0, handout: 0 });
  });

  it("defaults every kind to 0 for a submission with no deliverable rows at all", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.deliverableCounts).toEqual({ presentation: 0, poster: 0, handout: 0 });
  });
});
