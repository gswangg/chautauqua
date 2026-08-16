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
import { getSubmissionDetail } from "../src/server/repo/submissions/detail";
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
    reuploaded: null,
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
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "Talk One")],
      [], // participants
      [], // tracks
      [], // deliverable counts
      [], // latestFile candidates
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams({ contentStatus: ["changes_requested"] }));

    // Call index 3 is the page query (0: event prefix, 1: count, 2: DEC-913
    // grouped counts, 3: page).
    const pageCallLog = db.calls[3]!;
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
      [], // DEC-913 grouped counts
      Array.from({ length: 50 }, (_, i) => submissionRow(`sub-${i}`, i, `Talk ${i}`)),
      [],
      [],
      [],
      [],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
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
      [], // DEC-913 grouped counts
      Array.from({ length: 37 }, (_, i) => submissionRow(`sub-p3-${i}`, 100 + i, `Talk P3 ${i}`)),
      [],
      [],
      [],
      [],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
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
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
      [],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams({ sort: "worklist" }));

    const pageCallLog = db.calls[3]!;
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
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }],
      [], // latestFile candidates
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams());

    // Deliverable-count query is the 7th select() call (index 6).
    const deliverableCallLog = db.calls[6]!;
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
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      // Only a presentation chain-root row comes back — a file whose
      // previous_file_id is set would never appear here (excluded by the
      // WHERE, not filtered client-side), and poster/handout have none.
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }],
      [], // latestFile candidates
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.deliverableCounts).toEqual({ presentation: 1, poster: 0, handout: 0, recording: 0, photo: 0 });
  });

  it("defaults every kind to 0 for a submission with no deliverable rows at all", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
      [], // latestFile candidates
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.deliverableCounts).toEqual({ presentation: 0, poster: 0, handout: 0, recording: 0, photo: 0 });
  });
});

describe("listSubmissions latestFile (w15-f, DEC-686 page-scoped hydration)", () => {
  it("reports the most recently uploaded file in a two-version chain, with versionCount from the chain length", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [], // participants
      [], // tracks
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }], // deliverable counts
      // latestFile candidates: a v1 replaced by a v2 (previousFileId chain).
      [
        {
          id: "file-v1",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides-old.pdf",
          previousFileId: null,
          createdAt: new Date(2026, 0, 1),
          sizeBytes: 100,
          uploadedByContactId: null,
        },
        {
          id: "file-v2",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides-new.pdf",
          previousFileId: "file-v1",
          createdAt: new Date(2026, 0, 2),
          sizeBytes: 200,
          uploadedByContactId: null,
        },
      ],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.latestFile).toEqual({
      filename: "slides-new.pdf",
      kind: "presentation",
      versionCount: 2,
      uploadedAt: new Date(2026, 0, 2).getTime(),
    });
  });

  it("is null for a submission with no files", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
      [], // latestFile candidates — none
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.latestFile).toBeNull();
  });
});

// DEC-881: "re-uploaded" is ONE predicate — a submission's latest
// deliverable file's version_no > 1 — expressed once and read both as a
// row-projection field and as a server-side ?reuploaded= list filter.
describe("listSubmissions reuploaded (DEC-881)", () => {
  it("pushes reuploaded=true into the page-query WHERE as the version_no > 1 predicate", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
      [],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams({ reuploaded: true }));

    const pageCallLog = db.calls[3]!;
    const whereCall = pageCallLog.find((c: { method: string }) => c.method === "where");
    expect(whereCall).toBeDefined();
    const { sql } = dialect.sqlToQuery(whereCall!.args[0] as any);
    expect(sql).toContain('"file"."version_no"');
    expect(sql).toContain("> 1");
  });

  it("applies no reuploaded predicate when the filter is absent (null)", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
      [],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    await listSubmissions(db, EVENT_ID, baseParams());

    const pageCallLog = db.calls[3]!;
    const whereCall = pageCallLog.find((c: { method: string }) => c.method === "where");
    const { sql } = dialect.sqlToQuery(whereCall!.args[0] as any);
    expect(sql).not.toContain('"file"."version_no"');
  });

  it("reports reuploaded=true for a submission whose latest file's version_no is 2", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }],
      [
        {
          id: "file-v1",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides-old.pdf",
          previousFileId: null,
          createdAt: new Date(2026, 0, 1),
          sizeBytes: 100,
          uploadedByContactId: null,
          versionNo: 1,
        },
        {
          id: "file-v2",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides-new.pdf",
          previousFileId: "file-v1",
          createdAt: new Date(2026, 0, 2),
          sizeBytes: 200,
          uploadedByContactId: null,
          versionNo: 2,
        },
      ],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.reuploaded).toBe(true);
  });

  it("reports reuploaded=false for a submission with only its original upload", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [{ submissionId: "sub-1", kind: "presentation", count: 1 }],
      [
        {
          id: "file-v1",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides.pdf",
          previousFileId: null,
          createdAt: new Date(2026, 0, 1),
          sizeBytes: 100,
          uploadedByContactId: null,
          versionNo: 1,
        },
      ],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.reuploaded).toBe(false);
  });

  it("reports reuploaded=false for a submission with no files", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [],
      [],
      [],
      [],
      [], // scheduled (schedule_slot/room) enrichment (w41-b)
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.reuploaded).toBe(false);
  });
});

// w6-e (DEC-881): getSubmissionDetail's own read composes the SAME
// reUploadedSql() predicate the worklist row/header use (imported from
// submissions/list.ts, never re-derived) — the detail band's status can
// never disagree with the worklist row that opened it.
function detailBaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    eventId: EVENT_ID,
    formId: null,
    seq: 1,
    title: "A Talk",
    description: null,
    status: "accepted",
    contentStatus: "pending",
    acceptedAt: null,
    icsSequence: 0,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 2),
    recordPrefix: "SES",
    orgId: "org-a",
    startDate: "2024-01-01",
    slotDay: null,
    slotStartMin: null,
    slotEndMin: null,
    slotRoomName: null,
    reuploaded: 0,
    ...overrides,
  };
}

describe("getSubmissionDetail reuploaded (DEC-881)", () => {
  it("reports reuploaded=true when the base row's reUploadedSql projection is 1", async () => {
    const responses = [
      [detailBaseRow({ reuploaded: 1 })],
      [], // participantRows
      [], // trackRows
      [], // answerRows
      [], // answerFileRows
    ];
    const db = makeFakeDb(responses);

    const result = await getSubmissionDetail(db, "sub-1");

    expect(result!.reuploaded).toBe(true);
  });

  it("reports reuploaded=false when the base row's reUploadedSql projection is 0", async () => {
    const responses = [
      [detailBaseRow({ reuploaded: 0 })],
      [], // participantRows
      [], // trackRows
      [], // answerRows
      [], // answerFileRows
    ];
    const db = makeFakeDb(responses);

    const result = await getSubmissionDetail(db, "sub-1");

    expect(result!.reuploaded).toBe(false);
  });
});
