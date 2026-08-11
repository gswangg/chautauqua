import { describe, expect, it } from "vitest";
import {
  PERF_ANSWERS_PER_SUBMISSION,
  PERF_CONTACT_COUNT,
  PERF_EMAIL_LOG_COUNT,
  PERF_EMAIL_LOG_RECENT_WINDOW_DAYS,
  PERF_EMAIL_LOG_SPREAD_DAYS,
  PERF_EVALUATION_COUNT,
  PERF_PLAN_ID,
  PERF_REVIEWER_COUNT,
  PERF_REVIEWER_PASSWORD,
  PERF_ROOM_COUNT,
  PERF_STATUS_COUNTS,
  PERF_SUBMISSION_COUNT,
  PERF_TASK_ASSIGNMENT_COUNT,
  PERF_TASK_COUNT,
  PERF_TASKS,
  PERF_TOPICS,
  PERF_TRACK_COUNT,
  contactIndexForSubmission,
  isTaskAssignmentComplete,
  perfReviewerEmail,
  perfSubmissionStatuses,
  sentAtForEmailLogRow,
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

describe("DEC-338 onboarding task/task_assignment scale", () => {
  it("has exactly 5 tasks, one of them a file_request", () => {
    expect(PERF_TASK_COUNT).toBe(5);
    expect(PERF_TASKS).toHaveLength(5);
    const fileRequestCount = PERF_TASKS.filter((t) => t.kind === "file_request").length;
    expect(fileRequestCount).toBe(1);
  });

  it("assigns every task to every one of the 800 contacts: 4,000 rows", () => {
    expect(PERF_TASK_ASSIGNMENT_COUNT).toBe(PERF_TASK_COUNT * PERF_CONTACT_COUNT);
    expect(PERF_TASK_ASSIGNMENT_COUNT).toBe(4000);
  });

  it("mixes pending/complete by index modulo across the full grid", () => {
    let completeCount = 0;
    let pendingCount = 0;
    for (let taskIdx = 0; taskIdx < PERF_TASK_COUNT; taskIdx++) {
      for (let contactIdx = 0; contactIdx < PERF_CONTACT_COUNT; contactIdx++) {
        if (isTaskAssignmentComplete(taskIdx, contactIdx)) completeCount++;
        else pendingCount++;
      }
    }
    expect(completeCount).toBeGreaterThan(0);
    expect(pendingCount).toBeGreaterThan(0);
    expect(completeCount + pendingCount).toBe(PERF_TASK_ASSIGNMENT_COUNT);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => isTaskAssignmentComplete(-1, 0)).toThrow();
    expect(() => isTaskAssignmentComplete(0, -1)).toThrow();
    expect(() => isTaskAssignmentComplete(1.5, 0)).toThrow();
  });
});

describe("DEC-338 email_log scale + spread", () => {
  const NOW_MS = Date.UTC(2027, 6, 1, 0, 0, 0);

  it("seeds exactly 5,000 rows", () => {
    expect(PERF_EMAIL_LOG_COUNT).toBe(5000);
  });

  it("spreads sent_at across the last 30 days so the trailing-7-day window is a strict subset", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const recentCutoff = NOW_MS - PERF_EMAIL_LOG_RECENT_WINDOW_DAYS * DAY_MS;
    const spreadFloor = NOW_MS - PERF_EMAIL_LOG_SPREAD_DAYS * DAY_MS;
    let recentCount = 0;
    let olderCount = 0;
    for (let n = 0; n < PERF_EMAIL_LOG_COUNT; n++) {
      const sentAt = sentAtForEmailLogRow(n, NOW_MS);
      expect(sentAt).toBeLessThanOrEqual(NOW_MS);
      expect(sentAt).toBeGreaterThanOrEqual(spreadFloor);
      if (sentAt >= recentCutoff) recentCount++;
      else olderCount++;
    }
    // Strict subset: some rows within the last 7 days, but not all 5,000.
    expect(recentCount).toBeGreaterThan(0);
    expect(recentCount).toBeLessThan(PERF_EMAIL_LOG_COUNT);
    expect(olderCount).toBeGreaterThan(0);
  });

  it("is deterministic and rejects negative/non-integer input", () => {
    expect(sentAtForEmailLogRow(42, NOW_MS)).toEqual(sentAtForEmailLogRow(42, NOW_MS));
    expect(() => sentAtForEmailLogRow(-1, NOW_MS)).toThrow();
    expect(() => sentAtForEmailLogRow(1.5, NOW_MS)).toThrow();
    expect(() => sentAtForEmailLogRow(0, -1)).toThrow();
  });
});
