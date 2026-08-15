// DEC-258 wave-46 amendment: the public speaker DETAIL page's HEADER
// title/company must come from the contact's own (person-level) record, not
// from whichever visible submission's participant snapshot happens to sort
// first by title. Per-session entries are unaffected and keep exposing
// their own submission data. See decisions/DEC-258.md.
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import { getPublicSpeakerDetail } from "../src/server/repo/public/detail";

// Same fake-db double pattern as test/participant-answer-order.test.ts:
// records every chained call, replays queued row sets in db.select() call
// order.
function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  function chain(): any {
    const value = responses[cursor] ?? [];
    cursor += 1;
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) {
      obj[m] = (..._args: unknown[]) => obj;
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(value).then(resolve, reject);
    return obj;
  }
  return { select: () => chain(), selectDistinct: () => chain() } as unknown as AppEnv["Variables"]["db"];
}

const EVENT = { id: "event-1", recordPrefix: "SES", startDate: "2026-01-01", endDate: "2026-01-02", timezone: "UTC" } as any;

function baseRow(overrides: Record<string, unknown>) {
  return {
    contactId: "contact-1",
    firstName: "Ada",
    lastName: "Lovelace",
    // Page-level identity: the CONTACT's own title/company, deliberately
    // different from either submission's participant snapshot would have
    // been — proves the header no longer reads a per-talk snapshot at all.
    contactTitle: "Chief Scientist",
    contactCompany: "Analytical Engines Inc",
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    ...overrides,
  };
}

describe("DEC-258 wave-46: public speaker detail page header identity", () => {
  it("returns the contact's own title/company as the page-level identity, not a per-session snapshot", async () => {
    const rowsAppleFirst = [
      baseRow({ submissionId: "sub-apple", submissionTitle: "Apple Talk" }),
      baseRow({ submissionId: "sub-zebra", submissionTitle: "Zebra Talk" }),
    ];
    const db = makeFakeDb([
      rowsAppleFirst, // main rows query
      [], // slotRows
      [], // trackRows
    ]);

    const result = await getPublicSpeakerDetail(db, EVENT, "contact-1");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Chief Scientist");
    expect(result!.company).toBe("Analytical Engines Inc");
    // Per-session entries carry their own submission data, unaffected.
    expect(result!.sessions.map((s) => s.title).sort()).toEqual(["Apple Talk", "Zebra Talk"]);
  });

  it("is stable when the two submissions' sort order is swapped (no longer ordering-dependent)", async () => {
    const rowsZebraFirst = [
      baseRow({ submissionId: "sub-zebra", submissionTitle: "Zebra Talk" }),
      baseRow({ submissionId: "sub-apple", submissionTitle: "Apple Talk" }),
    ];
    const db = makeFakeDb([rowsZebraFirst, [], []]);

    const result = await getPublicSpeakerDetail(db, EVENT, "contact-1");

    expect(result!.title).toBe("Chief Scientist");
    expect(result!.company).toBe("Analytical Engines Inc");
  });

  it("per-session entries keep exposing their own submission title regardless of which row is first", async () => {
    const rows = [
      baseRow({ submissionId: "sub-1", submissionTitle: "First Talk" }),
      baseRow({ submissionId: "sub-2", submissionTitle: "Second Talk" }),
    ];
    const db = makeFakeDb([rows, [], []]);

    const result = await getPublicSpeakerDetail(db, EVENT, "contact-1");

    const bySubmission = new Map(result!.sessions.map((s) => [s.id, s.title]));
    expect(bySubmission.get("sub-1")).toBe("First Talk");
    expect(bySubmission.get("sub-2")).toBe("Second Talk");
  });

  it("returns null title/company when the contact has neither — no fabrication, no borrowing from a talk", async () => {
    const rows = [
      baseRow({ submissionId: "sub-1", submissionTitle: "Talk", contactTitle: null, contactCompany: null }),
    ];
    const db = makeFakeDb([rows, [], []]);

    const result = await getPublicSpeakerDetail(db, EVENT, "contact-1");

    expect(result!.title).toBeNull();
    expect(result!.company).toBeNull();
  });
});
