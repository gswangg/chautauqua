import { describe, expect, it } from "vitest";
import {
  PERF_ANSWERS_PER_SUBMISSION,
  PERF_CONTACT_COUNT,
  PERF_EVALUATION_COUNT,
  PERF_PLAN_ID,
  PERF_REVIEWER_COUNT,
  PERF_REVIEWER_PASSWORD,
  PERF_ROOM_COUNT,
  PERF_STATUS_COUNTS,
  PERF_SUBMISSION_COUNT,
  PERF_TOPICS,
  PERF_TRACK_COUNT,
  contactIndexForSubmission,
  perfReviewerEmail,
  perfSubmissionStatuses,
  slotPlacementForAccepted,
  topicForSubmission,
  totalPerfAnswerRows,
  trackIndexForSubmission,
} from "../scripts/perf-seed-lib";

describe("perfSubmissionStatuses", () => {
  it("returns 2,000 statuses matching the realistic status mix", () => {
    const statuses = perfSubmissionStatuses(PERF_SUBMISSION_COUNT);
    expect(statuses).toHaveLength(2000);
    const counts: Record<string, number> = {};
    for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
    expect(counts).toEqual(PERF_STATUS_COUNTS);
  });

  it("only uses DEC-003 submission status literals", () => {
    const allowed = new Set(["pending", "accept_queue", "decline_queue", "accepted", "declined"]);
    for (const s of perfSubmissionStatuses(PERF_SUBMISSION_COUNT)) {
      expect(allowed.has(s)).toBe(true);
    }
  });

  it("throws if count does not match the fixed distribution total", () => {
    expect(() => perfSubmissionStatuses(10)).toThrow();
  });
});

describe("totalPerfAnswerRows", () => {
  it("multiplies by the fixed per-submission answer rate", () => {
    expect(totalPerfAnswerRows(PERF_SUBMISSION_COUNT)).toBe(PERF_SUBMISSION_COUNT * PERF_ANSWERS_PER_SUBMISSION);
    expect(totalPerfAnswerRows(0)).toBe(0);
    expect(PERF_ANSWERS_PER_SUBMISSION).toBe(3);
  });

  it("rejects negative or non-integer counts", () => {
    expect(() => totalPerfAnswerRows(-1)).toThrow();
    expect(() => totalPerfAnswerRows(1.5)).toThrow();
  });
});

describe("contactIndexForSubmission", () => {
  it("cycles through the 800-contact pool", () => {
    expect(contactIndexForSubmission(0)).toBe(0);
    expect(contactIndexForSubmission(PERF_CONTACT_COUNT - 1)).toBe(PERF_CONTACT_COUNT - 1);
    expect(contactIndexForSubmission(PERF_CONTACT_COUNT)).toBe(0);
    expect(contactIndexForSubmission(PERF_SUBMISSION_COUNT - 1)).toBeLessThan(PERF_CONTACT_COUNT);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => contactIndexForSubmission(-1)).toThrow();
    expect(() => contactIndexForSubmission(1.5)).toThrow();
  });
});

describe("trackIndexForSubmission", () => {
  it("cycles through the 8-track pool", () => {
    expect(trackIndexForSubmission(0)).toBe(0);
    expect(trackIndexForSubmission(PERF_TRACK_COUNT - 1)).toBe(PERF_TRACK_COUNT - 1);
    expect(trackIndexForSubmission(PERF_TRACK_COUNT)).toBe(0);
    expect(trackIndexForSubmission(PERF_SUBMISSION_COUNT - 1)).toBeLessThan(PERF_TRACK_COUNT);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => trackIndexForSubmission(-1)).toThrow();
    expect(() => trackIndexForSubmission(1.5)).toThrow();
  });
});

describe("topicForSubmission", () => {
  it("cycles through the topic pool so a single-topic search matches a minority of rows", () => {
    expect(topicForSubmission(0)).toBe(PERF_TOPICS[0]);
    expect(topicForSubmission(PERF_TOPICS.length)).toBe(PERF_TOPICS[0]);
    const matches = Array.from({ length: PERF_SUBMISSION_COUNT }, (_, i) => topicForSubmission(i)).filter(
      (t) => t === PERF_TOPICS[0],
    ).length;
    // Well under SQLite's ~999-host-parameter limit that an id IN (...)
    // query built from a title-search match set would otherwise hit.
    expect(matches).toBeLessThan(200);
    expect(matches).toBeGreaterThan(0);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => topicForSubmission(-1)).toThrow();
    expect(() => topicForSubmission(1.5)).toThrow();
  });
});

describe("perfReviewerEmail (DEC-088)", () => {
  it("formats emails with an unpadded 1-based index", () => {
    expect(perfReviewerEmail(1)).toBe("perf.reviewer.1@example-perf.test");
    expect(perfReviewerEmail(12)).toBe("perf.reviewer.12@example-perf.test");
  });

  it("rejects non-positive or non-integer indices", () => {
    expect(() => perfReviewerEmail(0)).toThrow();
    expect(() => perfReviewerEmail(-1)).toThrow();
    expect(() => perfReviewerEmail(1.5)).toThrow();
  });
});

describe("DEC-088 pinned literals", () => {
  it("match the contract exactly", () => {
    expect(PERF_ROOM_COUNT).toBe(10);
    expect(PERF_REVIEWER_COUNT).toBe(12);
    expect(PERF_PLAN_ID).toBe("seed_perf_plan_0001");
    expect(PERF_REVIEWER_PASSWORD).toBe("PerfReviewer!2027");
    expect(PERF_EVALUATION_COUNT).toBe(600);
  });
});

describe("slotPlacementForAccepted", () => {
  it("places the first submission at day 1, 09:00, room 0", () => {
    expect(slotPlacementForAccepted(0)).toEqual({
      day: "2028-06-01",
      startMin: 540,
      endMin: 570,
      roomIndex: 0,
    });
  });

  it("rolls to day 2 after 100 sessions and rotates rooms", () => {
    expect(slotPlacementForAccepted(100)).toEqual({
      day: "2028-06-02",
      startMin: 540,
      endMin: 570,
      roomIndex: 0,
    });
    expect(slotPlacementForAccepted(101).roomIndex).toBe(1);
  });

  it("rolls to day 3 for the last block and spans 10 rooms x 10 time slots per day", () => {
    const last = slotPlacementForAccepted(299);
    expect(last.day).toBe("2028-06-03");
    expect(last.startMin).toBe(540 + 30 * 9);
    expect(last.roomIndex).toBe(9);
  });

  it("is deterministic and rejects negative/non-integer input", () => {
    expect(slotPlacementForAccepted(42)).toEqual(slotPlacementForAccepted(42));
    expect(() => slotPlacementForAccepted(-1)).toThrow();
    expect(() => slotPlacementForAccepted(1.5)).toThrow();
  });

  it("distributes 300 accepted submissions evenly: 3 days x 10 rooms x 10 slots", () => {
    const days = new Set<string>();
    const roomCounts: Record<number, number> = {};
    const slotKeyCounts: Record<string, number> = {};
    for (let j = 0; j < 300; j++) {
      const p = slotPlacementForAccepted(j);
      days.add(p.day);
      roomCounts[p.roomIndex] = (roomCounts[p.roomIndex] ?? 0) + 1;
      const key = `${p.day}|${p.startMin}|${p.roomIndex}`;
      slotKeyCounts[key] = (slotKeyCounts[key] ?? 0) + 1;
    }
    expect(days.size).toBe(3);
    expect(Object.keys(roomCounts).length).toBe(10);
    for (const count of Object.values(roomCounts)) {
      expect(count).toBe(30);
    }
    // No two accepted submissions ever collide on the same day/time/room.
    for (const count of Object.values(slotKeyCounts)) {
      expect(count).toBe(1);
    }
  });
});
