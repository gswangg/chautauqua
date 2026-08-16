// DEC-879 (wave-20 amendment, retargeted wave 9 / DEC-247 amendment): the
// per-kind deliverable map is spoken from FILE_KINDS, all four members --
// not a hand-typed subset. DEC-247's original subject (deliverableCounts, a
// zero-filled Record<FileKind, number>) was retired this wave, superseded
// by latestFileByKind (DEC-708/DEC-902) as the worklist's actual per-kind
// presence signal -- so this guard now asserts the SAME vocabulary rule
// against latestFileByKind's population: a file whose kind is any FILE_KINDS
// member (including 'recording') must be able to appear as a key, derived
// by iterating FILE_KINDS rather than a hand-typed list so a fifth kind
// added later is exercised by this test instead of silently escaping it.
// Unlike the retired zero-filled map, latestFileByKind is a Partial -- a
// kind with no files is simply absent, never zero-filled.
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

describe("listSubmissions latestFileByKind vocabulary (DEC-879, retargeted wave 9 / DEC-247 amendment)", () => {
  it("reports an empty map for a submission with no files at all -- absent, never zero-filled", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [], // participants
      [], // tracks
      [], // latestFile candidates
      [], // scheduled enrichment
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    expect(result.items[0]!.latestFileByKind).toEqual({});
  });

  it("reports a key for every FILE_KINDS member that has a file, including 'recording', with no hand-typed subset", async () => {
    const responses = [
      [{ recordPrefix: "SES" }],
      [{ count: 1 }],
      [], // DEC-913 grouped counts
      [submissionRow("sub-1", 1, "A Talk")],
      [], // participants
      [], // tracks
      // One candidate file row per FILE_KINDS member, derived from FILE_KINDS
      // itself (not hand-typed) so a fifth kind added later is exercised
      // here instead of silently escaping the population.
      FILE_KINDS.map((kind, i) => ({
        id: `file-${kind}`,
        submissionId: "sub-1",
        kind,
        filename: `${kind}.pdf`,
        previousFileId: null,
        createdAt: new Date(2026, 0, 1 + i),
        sizeBytes: 100,
        uploadedByContactId: null,
        versionNo: 1,
      })),
      [], // scheduled enrichment
    ];
    const db = makeFakeDb(responses);

    const result = await listSubmissions(db, EVENT_ID, baseParams());

    const byKind = result.items[0]!.latestFileByKind;
    expect(Object.keys(byKind).sort()).toEqual([...FILE_KINDS].sort());
    for (const kind of FILE_KINDS) {
      expect(byKind[kind]).toBe(1);
    }
  });
});
