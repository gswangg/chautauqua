/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  aggregateTriageCounts,
  aggregateSpeakerCounts,
  computeAgendaSummary,
  aggregateCommsCounts,
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

describe("aggregateCommsCounts (DEC-030 comms card)", () => {
  const now = 10 * 24 * 60 * 60 * 1000; // day 10

  it("counts sends within the trailing 7 days and reports the latest send", () => {
    const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;
    const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;
    expect(aggregateCommsCounts([sixDaysAgo, twentyDaysAgo], now)).toEqual({
      sentLast7Days: 1,
      lastSentAt: sixDaysAgo,
    });
  });

  it("returns lastSentAt null with no sends", () => {
    expect(aggregateCommsCounts([], now)).toEqual({ sentLast7Days: 0, lastSentAt: null });
  });
});
