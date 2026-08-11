/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  aggregateTriageCounts,
  aggregateSpeakerCounts,
  computeAgendaSummary,
  getOverviewPayload,
} from "../src/server/repo/overview";
import type { PlacedSession } from "../src/domain/schedule";

describe("aggregateTriageCounts (DEC-030 triage card)", () => {
  it("maps grouped status rows to the three triage buckets", () => {
    expect(
      aggregateTriageCounts([
        { status: "pending", n: 4 },
        { status: "accept_queue", n: 2 },
        { status: "decline_queue", n: 1 },
        { status: "accepted", n: 10 },
        { status: "declined", n: 3 },
      ]),
    ).toEqual({ pending: 4, accept_queue: 2, decline_queue: 1 });
  });

  it("defaults missing buckets to zero", () => {
    expect(aggregateTriageCounts([])).toEqual({ pending: 0, accept_queue: 0, decline_queue: 0 });
  });
});

describe("aggregateSpeakerCounts (DEC-030 speakers card)", () => {
  const now = 1_000_000;

  it("dedupes contactsOwing by contactId and counts overdue assignments", () => {
    expect(
      aggregateSpeakerCounts(
        [
          { contactId: "c1", dueDate: now - 1000 }, // overdue
          { contactId: "c1", dueDate: now + 1000 }, // same contact, not overdue
          { contactId: "c2", dueDate: null }, // no due date, never overdue
        ],
        now,
      ),
    ).toEqual({ contactsOwing: 2, overdueAssignments: 1 });
  });

  it("returns zeros when there are no pending assignments", () => {
    expect(aggregateSpeakerCounts([], now)).toEqual({ contactsOwing: 0, overdueAssignments: 0 });
  });
});

describe("computeAgendaSummary (DEC-030 agenda card, delegates to findConflicts)", () => {
  it("counts unplaced accepted submissions and delegates conflicts to findConflicts", () => {
    const placed: PlacedSession[] = [
      {
        submissionId: "s1",
        roomId: "r1",
        day: "2026-01-01",
        startMin: 60,
        endMin: 90,
        speakerContactIds: ["c1"],
      },
      {
        submissionId: "s2",
        roomId: "r1",
        day: "2026-01-01",
        startMin: 70,
        endMin: 100,
        speakerContactIds: ["c2"],
      },
    ];
    const result = computeAgendaSummary(["s1", "s2", "s3"], placed);
    expect(result.unplaced).toBe(1); // s3 has no slot
    expect(result.conflicts).toBe(1); // room_overlap between s1/s2
  });

  it("is zero/zero for no accepted submissions", () => {
    expect(computeAgendaSummary([], [])).toEqual({ unplaced: 0, conflicts: 0 });
  });
});

// Regression for DEC-333/DEC-334: getOverviewPayload's comms card must be
// derived from a single SQL aggregate row (count/max), never by reading the
// whole email_log table into memory and spreading it into Math.max. Uses the
// response-queue fake-db pattern from test/api-submissions.test.ts — a
// chainable object whose `then` pops the next queued response in call order.
describe("getOverviewPayload: comms card is one aggregate query (DEC-333, DEC-334)", () => {
  function makeFakeDb(responses: unknown[]) {
    let cursor = 0;
    function chain(): any {
      const obj: any = {};
      const passthrough = [
        "from",
        "where",
        "innerJoin",
        "orderBy",
        "limit",
        "offset",
        "select",
        "groupBy",
      ];
      for (const m of passthrough) obj[m] = () => obj;
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then(resolve, reject);
      };
      return obj;
    }
    return { select: () => chain() } as any;
  }

  it("returns comms derived from the single aggregate row, in call order", async () => {
    const now = 1_735_999_999_999;
    // Call order inside getOverviewPayload: triage status rows, plan count,
    // evaluations-submitted count, pending assignment rows, content count,
    // accepted-submission ids (empty, so the slot/participant queries are
    // skipped), then the comms aggregate row last.
    const responses = [
      [], // statusRows
      [{ count: 0 }], // planCountRows
      [{ count: 0 }], // evaluationsSubmittedRows
      [], // pendingAssignmentRows
      [{ count: 0 }], // contentRows
      [], // acceptedRows (empty -> no slot/participant queries)
      [{ sentLast7Days: 3, lastSentAt: 1735689600000 }], // commsRows (the only email_log query)
    ];
    const db = makeFakeDb(responses);

    const payload = await getOverviewPayload(db, "event-1", now);

    expect(payload.comms).toEqual({ sentLast7Days: 3, lastSentAt: 1735689600000 });
  });
});
