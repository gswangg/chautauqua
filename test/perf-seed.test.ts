import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";
import {
  PERF_CO_SPEAKERS_PER_ACCEPTED,
  PERF_EMAIL_LOG_COUNT,
  PERF_EMAIL_LOG_RECENT_WINDOW_DAYS,
  PERF_EMAIL_LOG_SPREAD_DAYS,
  PERF_EVALUATION_COUNT,
  PERF_FILE_COUNT,
  PERF_FILE_PRESENTATION_VERSIONS,
  PERF_FILE_ROWS_PER_SUBMISSION,
  PERF_ORG_USER_COUNT,
  PERF_PIPELINE_ENTRY_COUNT,
  PERF_PIPELINE_STAGES,
  PERF_PLAN_ID,
  PERF_PROFILES,
  PERF_REVIEWER_COUNT,
  PERF_REVIEWER_PASSWORD,
  PERF_ROOM_COUNT,
  PERF_TASK_ASSIGNMENT_COUNT,
  PERF_TASK_COUNT,
  PERF_TASKS,
  PERF_TOPICS,
  contactIndexForSubmission,
  contactsPerTask,
  coSpeakerContactIndexesForAccepted,
  isDeliberatelyOverdueAssignment,
  isTaskAssignmentComplete,
  overdueAssignmentCount,
  perfFileSpecs,
  perfOrgUserEmail,
  perfOrgUserRole,
  perfPlanId,
  perfReviewerEmail,
  perfSubmissionStatuses,
  pipelineStageIndexForEntry,
  sentAtForEmailLogRow,
  slotPlacementForAccepted,
  slotPlacementForAcceptedWithConflicts,
  topicForSubmission,
  totalPerfAnswerRows,
  trackIndexForSubmission,
} from "../scripts/perf-seed-lib";

// This file exercises the `default` profile end-to-end (today's perf-2k
// numbers); see test/perf-seed-lib.test.ts for the profile-threading and
// `aie` volume assertions (DEC-619).
const {
  submissionCount: PERF_SUBMISSION_COUNT,
  contactCount: PERF_CONTACT_COUNT,
  trackCount: PERF_TRACK_COUNT,
  answersPerSubmission: PERF_ANSWERS_PER_SUBMISSION,
  statusCounts: PERF_STATUS_COUNTS,
} = PERF_PROFILES.default;

describe("perfSubmissionStatuses", () => {
  it("returns 2,000 statuses matching the realistic status mix", () => {
    const statuses = perfSubmissionStatuses(PERF_SUBMISSION_COUNT, PERF_STATUS_COUNTS);
    expect(statuses).toHaveLength(2000);
    const counts: Record<string, number> = {};
    for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
    expect(counts).toEqual(PERF_STATUS_COUNTS);
  });

  it("only uses DEC-003 submission status literals", () => {
    const allowed = new Set(["pending", "accept_queue", "decline_queue", "accepted", "declined"]);
    for (const s of perfSubmissionStatuses(PERF_SUBMISSION_COUNT, PERF_STATUS_COUNTS)) {
      expect(allowed.has(s)).toBe(true);
    }
  });

  it("throws if count does not match the fixed distribution total", () => {
    expect(() => perfSubmissionStatuses(10, PERF_STATUS_COUNTS)).toThrow();
  });
});

describe("totalPerfAnswerRows", () => {
  it("multiplies by the fixed per-submission answer rate", () => {
    expect(totalPerfAnswerRows(PERF_SUBMISSION_COUNT, PERF_ANSWERS_PER_SUBMISSION)).toBe(PERF_SUBMISSION_COUNT * PERF_ANSWERS_PER_SUBMISSION);
    expect(totalPerfAnswerRows(0, PERF_ANSWERS_PER_SUBMISSION)).toBe(0);
    expect(PERF_ANSWERS_PER_SUBMISSION).toBe(3);
  });

  it("rejects negative or non-integer counts", () => {
    expect(() => totalPerfAnswerRows(-1, PERF_ANSWERS_PER_SUBMISSION)).toThrow();
    expect(() => totalPerfAnswerRows(1.5, PERF_ANSWERS_PER_SUBMISSION)).toThrow();
  });
});

describe("contactIndexForSubmission", () => {
  it("cycles through the 800-contact pool", () => {
    expect(contactIndexForSubmission(0, PERF_CONTACT_COUNT)).toBe(0);
    expect(contactIndexForSubmission(PERF_CONTACT_COUNT - 1, PERF_CONTACT_COUNT)).toBe(PERF_CONTACT_COUNT - 1);
    expect(contactIndexForSubmission(PERF_CONTACT_COUNT, PERF_CONTACT_COUNT)).toBe(0);
    expect(contactIndexForSubmission(PERF_SUBMISSION_COUNT - 1, PERF_CONTACT_COUNT)).toBeLessThan(PERF_CONTACT_COUNT);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => contactIndexForSubmission(-1, PERF_CONTACT_COUNT)).toThrow();
    expect(() => contactIndexForSubmission(1.5, PERF_CONTACT_COUNT)).toThrow();
  });
});

describe("trackIndexForSubmission", () => {
  it("cycles through the 8-track pool", () => {
    expect(trackIndexForSubmission(0, PERF_TRACK_COUNT)).toBe(0);
    expect(trackIndexForSubmission(PERF_TRACK_COUNT - 1, PERF_TRACK_COUNT)).toBe(PERF_TRACK_COUNT - 1);
    expect(trackIndexForSubmission(PERF_TRACK_COUNT, PERF_TRACK_COUNT)).toBe(0);
    expect(trackIndexForSubmission(PERF_SUBMISSION_COUNT - 1, PERF_TRACK_COUNT)).toBeLessThan(PERF_TRACK_COUNT);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => trackIndexForSubmission(-1, PERF_TRACK_COUNT)).toThrow();
    expect(() => trackIndexForSubmission(1.5, PERF_TRACK_COUNT)).toThrow();
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
    expect(PERF_EVALUATION_COUNT).toBe(6000);
  });

  it("DEC-347: holds at least 5,000 evaluation rows for the plan's current round", () => {
    expect(PERF_EVALUATION_COUNT).toBeGreaterThanOrEqual(5000);
  });

  it("DEC-347: the (submission, reviewer) round-robin pairing over PERF_EVALUATION_COUNT never repeats — " +
    "no duplicate (plan_id, submission_id, reviewer_id, round) row, matching the evaluation table's unique index", () => {
    const seen = new Set<string>();
    for (let n = 0; n < PERF_EVALUATION_COUNT; n++) {
      const submissionIdx = n % PERF_SUBMISSION_COUNT;
      const reviewerIdx = n % PERF_REVIEWER_COUNT;
      const key = `${submissionIdx}|${reviewerIdx}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("slotPlacementForAccepted", () => {
  // `default` profile numbers throughout — DEC-645 parameterized this
  // helper (was module-constant-only), but the `default` profile's own
  // placements must stay bit-for-bit identical to the pre-DEC-645 hardcoded
  // 3-day/100-per-day/10-room contract.
  const ROOMS = PERF_ROOM_COUNT;
  const DAYS = 3;
  const ACCEPTED = 300;

  it("places the first submission at day 1, 09:00, room 0", () => {
    expect(slotPlacementForAccepted(0, ROOMS, DAYS, ACCEPTED)).toEqual({
      day: "2028-06-01",
      startMin: 540,
      endMin: 570,
      roomIndex: 0,
    });
  });

  it("rolls to day 2 after 100 sessions and rotates rooms", () => {
    expect(slotPlacementForAccepted(100, ROOMS, DAYS, ACCEPTED)).toEqual({
      day: "2028-06-02",
      startMin: 540,
      endMin: 570,
      roomIndex: 0,
    });
    expect(slotPlacementForAccepted(101, ROOMS, DAYS, ACCEPTED).roomIndex).toBe(1);
  });

  it("rolls to day 3 for the last block and spans 10 rooms x 10 time slots per day", () => {
    const last = slotPlacementForAccepted(299, ROOMS, DAYS, ACCEPTED);
    expect(last.day).toBe("2028-06-03");
    expect(last.startMin).toBe(540 + 30 * 9);
    expect(last.roomIndex).toBe(9);
  });

  it("is deterministic and rejects negative/non-integer input", () => {
    expect(slotPlacementForAccepted(42, ROOMS, DAYS, ACCEPTED)).toEqual(slotPlacementForAccepted(42, ROOMS, DAYS, ACCEPTED));
    expect(() => slotPlacementForAccepted(-1, ROOMS, DAYS, ACCEPTED)).toThrow();
    expect(() => slotPlacementForAccepted(1.5, ROOMS, DAYS, ACCEPTED)).toThrow();
    expect(() => slotPlacementForAccepted(0, 0, DAYS, ACCEPTED)).toThrow();
    expect(() => slotPlacementForAccepted(0, ROOMS, 0, ACCEPTED)).toThrow();
    expect(() => slotPlacementForAccepted(0, ROOMS, DAYS, 0)).toThrow();
  });

  it("distributes 300 accepted submissions evenly: 3 days x 10 rooms x 10 slots", () => {
    const days = new Set<string>();
    const roomCounts: Record<number, number> = {};
    const slotKeyCounts: Record<string, number> = {};
    for (let j = 0; j < 300; j++) {
      const p = slotPlacementForAccepted(j, ROOMS, DAYS, ACCEPTED);
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

describe("DEC-645 aie schedule placement: 250 accepted over 4 days x 10 rooms", () => {
  const aie = PERF_PROFILES.aie;
  const ACCEPTED = aie.statusCounts.accepted!;

  it("spans exactly aie.dayCount distinct days", () => {
    const days = new Set<string>();
    for (let j = 0; j < ACCEPTED; j++) {
      days.add(slotPlacementForAccepted(j, aie.roomCount, aie.dayCount, ACCEPTED).day);
    }
    expect(days.size).toBe(aie.dayCount);
    expect(aie.dayCount).toBe(4);
  });

  it("never collides on the same day/time/room", () => {
    const slotKeyCounts: Record<string, number> = {};
    for (let j = 0; j < ACCEPTED; j++) {
      const p = slotPlacementForAccepted(j, aie.roomCount, aie.dayCount, ACCEPTED);
      const key = `${p.day}|${p.startMin}|${p.roomIndex}`;
      slotKeyCounts[key] = (slotKeyCounts[key] ?? 0) + 1;
    }
    for (const count of Object.values(slotKeyCounts)) {
      expect(count).toBe(1);
    }
  });
});

describe("DEC-645 slotPlacementForAcceptedWithConflicts", () => {
  const ROOMS = 10;
  const DAYS = 3;
  const ACCEPTED = 300;

  it("with deliberateConflictCount 0, always matches the plain placement (default profile, bit-for-bit)", () => {
    for (let j = 0; j < 20; j++) {
      expect(slotPlacementForAcceptedWithConflicts(j, ROOMS, DAYS, ACCEPTED, 0)).toEqual(
        slotPlacementForAccepted(j, ROOMS, DAYS, ACCEPTED),
      );
    }
  });

  it("places exactly deliberateConflictCount overlapping pairs, deterministically", () => {
    const deliberateConflictCount = 12;
    const placements = Array.from({ length: ACCEPTED }, (_, j) =>
      slotPlacementForAcceptedWithConflicts(j, ROOMS, DAYS, ACCEPTED, deliberateConflictCount),
    );
    const keyCounts: Record<string, number> = {};
    for (const p of placements) {
      const key = `${p.day}|${p.startMin}|${p.roomIndex}`;
      keyCounts[key] = (keyCounts[key] ?? 0) + 1;
    }
    const overlappingPairs = Object.values(keyCounts).filter((c) => c === 2).length;
    const tripleOrMore = Object.values(keyCounts).filter((c) => c > 2).length;
    expect(overlappingPairs).toBe(deliberateConflictCount);
    expect(tripleOrMore).toBe(0);
    // Second run is identical (deterministic).
    const placementsAgain = Array.from({ length: ACCEPTED }, (_, j) =>
      slotPlacementForAcceptedWithConflicts(j, ROOMS, DAYS, ACCEPTED, deliberateConflictCount),
    );
    expect(placementsAgain).toEqual(placements);
  });

  it("rejects a negative deliberateConflictCount", () => {
    expect(() => slotPlacementForAcceptedWithConflicts(0, ROOMS, DAYS, ACCEPTED, -1)).toThrow();
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

describe("DEC-347 perfFileSpecs (deliverable file chains at scale)", () => {
  const accepted = PERF_STATUS_COUNTS.accepted!; // 300
  const specs = perfFileSpecs(accepted);

  it("has exactly 4 rows per accepted submission: 300 * 4 = 1,200", () => {
    expect(PERF_FILE_ROWS_PER_SUBMISSION).toBe(4);
    expect(PERF_FILE_COUNT).toBe(accepted * 4);
    expect(PERF_FILE_COUNT).toBe(1200);
    expect(specs).toHaveLength(PERF_FILE_COUNT);
  });

  it("every row's n is unique across the whole 1,200-row set", () => {
    const ns = new Set(specs.map((s) => s.n));
    expect(ns.size).toBe(specs.length);
  });

  it("exactly 300 chains have 3 presentation versions, and 300 have exactly 1 handout version", () => {
    const byAccepted = new Map<number, { presentation: number; handout: number }>();
    for (const s of specs) {
      const entry = byAccepted.get(s.acceptedIndex) ?? { presentation: 0, handout: 0 };
      entry[s.kind] += 1;
      byAccepted.set(s.acceptedIndex, entry);
    }
    expect(byAccepted.size).toBe(accepted);
    let threeVersionChains = 0;
    let oneVersionChains = 0;
    for (const entry of byAccepted.values()) {
      expect(entry.presentation).toBe(PERF_FILE_PRESENTATION_VERSIONS);
      expect(entry.handout).toBe(1);
      if (entry.presentation === 3) threeVersionChains++;
      if (entry.handout === 1) oneVersionChains++;
    }
    expect(threeVersionChains).toBe(300);
    expect(oneVersionChains).toBe(300);
  });

  it("every non-root row's previousN points at a row in the same chain (same acceptedIndex + kind)", () => {
    const byN = new Map(specs.map((s) => [s.n, s]));
    for (const s of specs) {
      if (s.previousN === null) continue;
      const prev = byN.get(s.previousN);
      expect(prev).toBeDefined();
      expect(prev!.acceptedIndex).toBe(s.acceptedIndex);
      expect(prev!.kind).toBe(s.kind);
      expect(prev!.versionIndex).toBe(s.versionIndex - 1);
    }
  });

  it("no chain has a cycle (walking previousN from any row terminates at a root within its own chain length)", () => {
    const byN = new Map(specs.map((s) => [s.n, s]));
    for (const s of specs) {
      const visited = new Set<number>();
      let cur: typeof s | undefined = s;
      let steps = 0;
      while (cur) {
        expect(visited.has(cur.n)).toBe(false);
        visited.add(cur.n);
        steps++;
        expect(steps).toBeLessThanOrEqual(PERF_FILE_PRESENTATION_VERSIONS);
        if (cur.previousN === null) break;
        cur = byN.get(cur.previousN);
      }
    }
  });

  it("root rows (versionIndex 0) always have previousN null; non-root rows never do", () => {
    for (const s of specs) {
      if (s.versionIndex === 0) expect(s.previousN).toBeNull();
      else expect(s.previousN).not.toBeNull();
    }
  });

  it("is deterministic and rejects negative/non-integer input", () => {
    expect(perfFileSpecs(5)).toEqual(perfFileSpecs(5));
    expect(() => perfFileSpecs(-1)).toThrow();
    expect(() => perfFileSpecs(1.5)).toThrow();
  });

  it("returns an empty array for 0 accepted submissions", () => {
    expect(perfFileSpecs(0)).toEqual([]);
  });
});

describe("DEC-469 pipeline_entry scale (pipeline board perf check)", () => {
  it("caps entry count at PERF_CONTACT_COUNT (pipeline_entry's UNIQUE(org_id, contact_id) index)", () => {
    expect(PERF_PIPELINE_ENTRY_COUNT).toBe(PERF_CONTACT_COUNT);
    expect(PERF_PIPELINE_ENTRY_COUNT).toBeGreaterThan(100);
  });

  it("spreads entries evenly across all five PIPELINE_STAGES", () => {
    expect(PERF_PIPELINE_STAGES).toEqual(["identified", "contacted", "interested", "confirmed", "declined"]);
    const counts: Record<number, number> = {};
    for (let i = 0; i < PERF_PIPELINE_ENTRY_COUNT; i++) {
      const idx = pipelineStageIndexForEntry(i);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    expect(Object.keys(counts).length).toBe(PERF_PIPELINE_STAGES.length);
    for (const idx of Object.keys(counts).map(Number)) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(PERF_PIPELINE_STAGES.length);
    }
  });

  it("is deterministic and rejects negative/non-integer input", () => {
    expect(pipelineStageIndexForEntry(42)).toBe(pipelineStageIndexForEntry(42));
    expect(() => pipelineStageIndexForEntry(-1)).toThrow();
    expect(() => pipelineStageIndexForEntry(1.5)).toThrow();
  });
});

describe("DEC-495 coSpeakerContactIndexesForAccepted (public speaker scale)", () => {
  it("returns PERF_CO_SPEAKERS_PER_ACCEPTED distinct indexes for a single call", () => {
    const idxs = coSpeakerContactIndexesForAccepted(0);
    expect(idxs).toHaveLength(PERF_CO_SPEAKERS_PER_ACCEPTED);
    expect(new Set(idxs).size).toBe(idxs.length);
    for (const idx of idxs) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(PERF_CONTACT_COUNT);
    }
  });

  it("is deterministic and rejects negative/non-integer input", () => {
    expect(coSpeakerContactIndexesForAccepted(42)).toEqual(coSpeakerContactIndexesForAccepted(42));
    expect(() => coSpeakerContactIndexesForAccepted(-1)).toThrow();
    expect(() => coSpeakerContactIndexesForAccepted(1.5)).toThrow();
    expect(() => coSpeakerContactIndexesForAccepted(0, -1)).toThrow();
  });

  it("never collides with any accepted submission's own primary-speaker contact", () => {
    const statuses = perfSubmissionStatuses(PERF_SUBMISSION_COUNT, PERF_STATUS_COUNTS);
    let j = 0;
    for (let i = 0; i < PERF_SUBMISSION_COUNT; i++) {
      if (statuses[i] !== "accepted") continue;
      const primary = contactIndexForSubmission(i, PERF_CONTACT_COUNT);
      const coIdxs = coSpeakerContactIndexesForAccepted(j);
      expect(coIdxs).not.toContain(primary);
      j++;
    }
  });

  it("SPEC.md:73-76 scale: accepted + co-speaker participants cover at least 800 distinct contacts", () => {
    const statuses = perfSubmissionStatuses(PERF_SUBMISSION_COUNT, PERF_STATUS_COUNTS);
    const visible = new Set<number>();
    let j = 0;
    for (let i = 0; i < PERF_SUBMISSION_COUNT; i++) {
      if (statuses[i] !== "accepted") continue;
      visible.add(contactIndexForSubmission(i, PERF_CONTACT_COUNT));
      for (const idx of coSpeakerContactIndexesForAccepted(j)) visible.add(idx);
      j++;
    }
    expect(j).toBe(300);
    expect(visible.size).toBeGreaterThanOrEqual(800);
  });
});

describe("DEC-469 extra org user scale (org user directory perf check)", () => {
  it("adds enough rows that the shared org clears a 100-row exercised-scale floor " +
    "(7 demo + 12 PERF_REVIEWER_COUNT + PERF_ORG_USER_COUNT)", () => {
    expect(7 + PERF_REVIEWER_COUNT + PERF_ORG_USER_COUNT).toBeGreaterThan(100);
  });

  it("formats unique, distinct-from-reviewer emails with a 1-based index", () => {
    expect(perfOrgUserEmail(1)).toBe("perf.orguser.1@example-perf.test");
    expect(perfOrgUserEmail(85)).toBe("perf.orguser.85@example-perf.test");
  });

  it("rejects non-positive or non-integer indices", () => {
    expect(() => perfOrgUserEmail(0)).toThrow();
    expect(() => perfOrgUserEmail(-1)).toThrow();
    expect(() => perfOrgUserEmail(1.5)).toThrow();
  });

  it("mixes reviewer and organizer roles, both present across PERF_ORG_USER_COUNT rows", () => {
    const roles = Array.from({ length: PERF_ORG_USER_COUNT }, (_, i) => perfOrgUserRole(i));
    expect(roles.some((r) => r === "organizer")).toBe(true);
    expect(roles.some((r) => r === "reviewer")).toBe(true);
    expect(roles.every((r) => r === "organizer" || r === "reviewer")).toBe(true);
  });

  it("rejects negative or non-integer indices", () => {
    expect(() => perfOrgUserRole(-1)).toThrow();
    expect(() => perfOrgUserRole(1.5)).toThrow();
  });
});

describe("DEC-645 perfPlanId", () => {
  it("planIndex 1 returns basePlanId unchanged (default profile bit-for-bit)", () => {
    expect(perfPlanId("seed_perf_plan_0001", 1)).toBe("seed_perf_plan_0001");
  });

  it("planIndex > 1 suffixes _<planIndex>", () => {
    expect(perfPlanId("seed_perf_aie_plan_0001", 2)).toBe("seed_perf_aie_plan_0001_2");
    expect(perfPlanId("seed_perf_aie_plan_0001", 3)).toBe("seed_perf_aie_plan_0001_3");
  });

  it("aie profile's 3 plan ids are all distinct", () => {
    const aie = PERF_PROFILES.aie;
    const ids = Array.from({ length: aie.planCount }, (_, i) => perfPlanId(aie.planId, i + 1));
    expect(new Set(ids).size).toBe(aie.planCount);
    expect(aie.planCount).toBe(3);
  });

  it("rejects an empty basePlanId or a non-positive/non-integer planIndex", () => {
    expect(() => perfPlanId("", 1)).toThrow();
    expect(() => perfPlanId("x", 0)).toThrow();
    expect(() => perfPlanId("x", -1)).toThrow();
    expect(() => perfPlanId("x", 1.5)).toThrow();
  });
});

describe("DEC-645 contactsPerTask", () => {
  it("default profile: 4000 / 5 = 800 (matches PERF_CONTACT_COUNT, unchanged)", () => {
    expect(contactsPerTask(PERF_PROFILES.default.taskCount, PERF_TASK_COUNT)).toBe(PERF_CONTACT_COUNT);
    expect(contactsPerTask(4000, 5)).toBe(800);
  });

  it("aie profile: 400 / 5 = 80", () => {
    expect(contactsPerTask(PERF_PROFILES.aie.taskCount, PERF_TASK_COUNT)).toBe(80);
  });

  it("throws when taskCount does not divide evenly by taskDefCount", () => {
    expect(() => contactsPerTask(11, 5)).toThrow();
  });

  it("rejects negative/non-integer input", () => {
    expect(() => contactsPerTask(-1, 5)).toThrow();
    expect(() => contactsPerTask(10, 0)).toThrow();
    expect(() => contactsPerTask(1.5, 5)).toThrow();
  });
});

describe("DEC-645 overdueAssignmentCount + isDeliberatelyOverdueAssignment", () => {
  it("default profile: overdueTaskFraction 0 => 0 deliberately-overdue rows", () => {
    expect(overdueAssignmentCount(PERF_PROFILES.default.taskCount, PERF_PROFILES.default.overdueTaskFraction)).toBe(0);
    for (let taskIdx = 0; taskIdx < 2; taskIdx++) {
      for (let c = 0; c < 5; c++) {
        expect(isDeliberatelyOverdueAssignment(taskIdx, c, 0)).toBe(false);
      }
    }
  });

  it("aie profile: ~15% of 400 => exactly 60 deliberately-overdue rows, all on task index 0", () => {
    const aie = PERF_PROFILES.aie;
    const count = overdueAssignmentCount(aie.taskCount, aie.overdueTaskFraction);
    expect(count).toBe(60);
    expect(count / aie.taskCount).toBeCloseTo(0.15, 5);
    const contactsPerTaskCount = contactsPerTask(aie.taskCount, PERF_TASK_COUNT);
    let overdueTotal = 0;
    for (let taskIdx = 0; taskIdx < PERF_TASK_COUNT; taskIdx++) {
      for (let c = 0; c < contactsPerTaskCount; c++) {
        if (isDeliberatelyOverdueAssignment(taskIdx, c, count)) {
          expect(taskIdx).toBe(0);
          overdueTotal++;
        }
      }
    }
    expect(overdueTotal).toBe(60);
  });

  it("rejects negative/non-integer input and an out-of-range fraction", () => {
    expect(() => overdueAssignmentCount(-1, 0.15)).toThrow();
    expect(() => overdueAssignmentCount(10, -0.1)).toThrow();
    expect(() => overdueAssignmentCount(10, 1.1)).toThrow();
    expect(() => isDeliberatelyOverdueAssignment(-1, 0, 0)).toThrow();
    expect(() => isDeliberatelyOverdueAssignment(0, -1, 0)).toThrow();
    expect(() => isDeliberatelyOverdueAssignment(0, 0, -1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// DEC-645: runs the actual perf-seed.ts script (tsx subprocess, same as
// `npm run perf:seed:aie`'s first step) with --profile=aie and inspects the
// generated .perf-seed.sql output, so this fails if the real script's
// output ever regresses — never applied against a real D1 (no wrangler
// step), matching seed.ts's own DEC-145 pattern in test/seed.test.ts.
// ---------------------------------------------------------------------------
describe("perf-seed.ts --profile=aie output (DEC-645)", () => {
  const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(SCRIPT_DIR, "..");
  const OUTPUT_PATH = join(REPO_ROOT, ".perf-seed.sql");

  let sql: string;
  let lines: string[];

  beforeAll(() => {
    execFileSync("npx", ["tsx", "scripts/perf-seed.ts", "--profile=aie"], { cwd: REPO_ROOT, stdio: "inherit" });
    expect(existsSync(OUTPUT_PATH)).toBe(true);
    sql = readFileSync(OUTPUT_PATH, "utf-8");
    lines = sql.split("\n");
  }, 120_000);

  const aie = PERF_PROFILES.aie;

  it("seeds exactly aie.roomCount room rows", () => {
    const count = lines.filter((l) => l.startsWith("INSERT INTO room ")).length;
    expect(count).toBe(aie.roomCount);
    expect(count).toBe(10);
  });

  it("schedule_slot rows span exactly aie.dayCount distinct days", () => {
    const slotLines = lines.filter((l) => l.startsWith("INSERT INTO schedule_slot "));
    expect(slotLines).toHaveLength(aie.statusCounts.accepted!);
    const days = new Set(slotLines.map((l) => l.match(/'(2028-06-\d{2})'/)?.[1]));
    expect(days.size).toBe(aie.dayCount);
    expect(aie.dayCount).toBe(4);
  });

  it("seeds exactly aie.planCount evaluation_plan rows and aie.planCount * aie.reviewerCount plan_reviewer rows", () => {
    const planCount = lines.filter((l) => l.startsWith("INSERT INTO evaluation_plan ")).length;
    const planReviewerCount = lines.filter((l) => l.startsWith("INSERT INTO plan_reviewer ")).length;
    expect(planCount).toBe(aie.planCount);
    expect(planReviewerCount).toBe(aie.planCount * aie.reviewerCount);
    expect(planReviewerCount).toBe(45);
  });

  it("seeds exactly aie.reviewerCount reviewer users under aie's reviewer email prefix", () => {
    const prefixEmails = new Set(
      Array.from(sql.matchAll(new RegExp(`'${aie.reviewerEmailPrefix}\\.(\\d+)@example-perf\\.test'`, "g"))).map(
        (m) => m[0],
      ),
    );
    expect(prefixEmails.size).toBe(aie.reviewerCount);
    expect(prefixEmails.size).toBe(15);
  });

  it("seeds exactly aie.taskCount task_assignment rows, with exactly overdueAssignmentCount(aie) rows " +
    "deliberately pending against task index 0's past due_date", () => {
    const taskLines = lines.filter((l) => l.startsWith("INSERT INTO task "));
    const assignmentLines = lines.filter((l) => l.startsWith("INSERT INTO task_assignment "));
    expect(assignmentLines).toHaveLength(aie.taskCount);
    expect(aie.taskCount).toBe(400);

    // Task index 0's id + its due_date (must be in the past).
    const firstTask = taskLines[0]!;
    const firstTaskId = firstTask.match(/VALUES \('([^']+)'/)![1];
    const firstTaskDueDate = Number(firstTask.match(/, (\d+), 0, NULL,/)![1]);
    expect(firstTaskDueDate).toBeLessThan(Date.now());

    const expectedOverdue = overdueAssignmentCount(aie.taskCount, aie.overdueTaskFraction);
    expect(expectedOverdue).toBe(60);

    // Every one of the first `expectedOverdue` contacts assigned to task 0
    // must be seeded 'pending' (never 'complete') — the deliberate-overdue
    // contract; verified against the real per-contact ordering the script
    // writes (first contactsPerTask contacts for task index 0).
    const contactsPerTaskCount = contactsPerTask(aie.taskCount, PERF_TASK_COUNT);
    const task0Assignments = assignmentLines.filter((l) => l.includes(`'${firstTaskId}',`));
    expect(task0Assignments).toHaveLength(contactsPerTaskCount);
    for (let c = 0; c < expectedOverdue; c++) {
      expect(task0Assignments[c]).toContain("'pending'");
    }
  });

  it("places exactly aie.deliberateConflictCount overlapping schedule_slot pairs (same day/start_min/room)", () => {
    const slotLines = lines.filter((l) => l.startsWith("INSERT INTO schedule_slot "));
    const keyCounts = new Map<string, number>();
    for (const l of slotLines) {
      const m = l.match(/'(seed_perf_room_\d+)', '(2028-06-\d{2})', (\d+), (\d+)/);
      expect(m).toBeTruthy();
      const key = `${m![2]}|${m![3]}|${m![1]}`;
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
    const pairCount = Array.from(keyCounts.values()).filter((c) => c === 2).length;
    const tripleOrMoreCount = Array.from(keyCounts.values()).filter((c) => c > 2).length;
    expect(pairCount).toBe(aie.deliberateConflictCount);
    expect(pairCount).toBeGreaterThanOrEqual(12);
    expect(tripleOrMoreCount).toBe(0);
  });

  it("the idempotent DELETE prologue covers every profile's plan ids (never orphans a switched --profile= run)", () => {
    const evalPlanDelete = lines.find((l) => l.startsWith("DELETE FROM evaluation_plan "));
    expect(evalPlanDelete).toBeTruthy();
    for (const profile of Object.values(PERF_PROFILES)) {
      for (let i = 1; i <= profile.planCount; i++) {
        expect(evalPlanDelete).toContain(`'${perfPlanId(profile.planId, i)}'`);
      }
    }
  });
});
