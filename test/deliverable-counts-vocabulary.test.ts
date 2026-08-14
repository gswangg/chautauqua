// DEC-879 (wave-20 amendment): deliverableCounts is spoken from FILE_KINDS,
// all four members — a submission with no deliverable rows (or with rows in
// only some kinds) must still report every FILE_KINDS key, including
// 'recording'. Iterates FILE_KINDS rather than a hand-typed key list so a
// fifth kind added later fails this test instead of silently escaping it.
import { describe, expect, it } from "vitest";
import { listSubmissions } from "../src/server/repo/submissions/list";
import { FILE_KINDS } from "../src/domain/files";
import type { ParsedListQuery } from "../src/server/repo/submissions/query";

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
  function chain(): any {
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) {
      obj[m] = (...args: unknown[]) => obj;
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const value = responses[cursor];
      cursor += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { select: () => chain() } as any;
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

describe("listSubmissions deliverableCounts vocabulary (DEC-879 wave-20 amendment)", () => {
  it("reports every FILE_KINDS key at 0 for a submission with no files at all", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [], // participants
      [], // tracks
      [], // deliverable counts (none)
      [], // latestFile candidates
      [], // scheduled enrichment
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    const counts = result.items[0]!.deliverableCounts;
    for (const kind of FILE_KINDS) {
      expect(counts[kind]).toBe(0);
    }
    expect(Object.keys(counts).sort()).toEqual([...FILE_KINDS].sort());
    expect(counts.recording).toBe(0);
  });

  it("reports recording: N with every other FILE_KINDS key at 0 when only recording rows exist", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [], // participants
      [], // tracks
      [{ submissionId: "sub-1", kind: "recording", count: 3 }], // deliverable counts
      [], // latestFile candidates
      [], // scheduled enrichment
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    const counts = result.items[0]!.deliverableCounts;
    expect(counts.recording).toBe(3);
    for (const kind of FILE_KINDS) {
      if (kind === "recording") continue;
      expect(counts[kind]).toBe(0);
    }
  });
});
