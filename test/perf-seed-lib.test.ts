import { describe, expect, it } from "vitest";
import {
  PERF_PROFILES,
  PERF_SPEAKER_CONTACT_ID,
  PERF_SPEAKER_EMAIL,
  PERF_SPEAKER_PASSWORD,
  PERF_SPEAKER_SUBMISSION_COUNT,
  PERF_SPEAKER_USER_ID,
  PERF_TASK_COUNT,
  contactIndexForSubmission,
  isPerfSpeakerTaskAssignmentComplete,
  perfSpeakerAcceptedIndexes,
  perfSpeakerParticipantId,
  perfSpeakerTaskAssignmentId,
  perfSubmissionStatuses,
  totalPerfAnswerRows,
  trackIndexForSubmission,
} from "../scripts/perf-seed-lib";

// DEC-619: the `aie` scale-mandate profile's volumes and its threading
// through the profile-parameterized helpers. See test/perf-seed.test.ts for
// the `default` profile exercised end-to-end (today's perf-2k numbers,
// unchanged bit-for-bit).

describe("PERF_PROFILES.aie (docs/mandates/scale-mandate.md)", () => {
  const aie = PERF_PROFILES.aie;

  it("matches the scale-mandate volumes: 2,500 submissions across 20 tracks, 6,000 contacts", () => {
    expect(aie.submissionCount).toBe(2500);
    expect(aie.trackCount).toBe(20);
    expect(aie.contactCount).toBe(6000);
  });

  it("weights statuses to ~10% accepted", () => {
    expect(aie.statusCounts.accepted).toBe(250);
    expect(aie.statusCounts.accepted! / aie.submissionCount).toBeCloseTo(0.1, 5);
  });

  it("threads through perfSubmissionStatuses without throwing (statusCounts sums to submissionCount)", () => {
    const statuses = perfSubmissionStatuses(aie.submissionCount, aie.statusCounts);
    expect(statuses).toHaveLength(aie.submissionCount);
  });

  it("threads through contactIndexForSubmission/trackIndexForSubmission at aie scale", () => {
    expect(contactIndexForSubmission(aie.contactCount - 1, aie.contactCount)).toBe(aie.contactCount - 1);
    expect(contactIndexForSubmission(aie.contactCount, aie.contactCount)).toBe(0);
    expect(trackIndexForSubmission(aie.trackCount - 1, aie.trackCount)).toBe(aie.trackCount - 1);
    expect(trackIndexForSubmission(aie.trackCount, aie.trackCount)).toBe(0);
  });

  it("threads through totalPerfAnswerRows", () => {
    expect(totalPerfAnswerRows(aie.submissionCount, aie.answersPerSubmission)).toBe(
      aie.submissionCount * aie.answersPerSubmission,
    );
  });

  // DEC-645: docs/mandates/scale-mandate.md's remaining scale volumes
  // (agenda/review/onboarding surfaces) — 10 rooms, 4 days, 15 reviewers,
  // 3 plans, 400 speaker tasks at ~15% overdue, >=12 deliberate conflicts.
  it("matches DEC-645's agenda/review/onboarding volumes", () => {
    expect(aie.roomCount).toBe(10);
    expect(aie.dayCount).toBe(4);
    expect(aie.reviewerCount).toBe(15);
    expect(aie.planCount).toBe(3);
    expect(aie.taskCount).toBe(400);
    expect(aie.overdueTaskFraction).toBeCloseTo(0.15, 5);
    expect(aie.deliberateConflictCount).toBeGreaterThanOrEqual(12);
  });

  it("has a distinct planId from the default profile, still inside the seed_perf_ namespace", () => {
    expect(aie.planId).not.toBe(PERF_PROFILES.default.planId);
    expect(aie.planId.startsWith("seed_perf_")).toBe(true);
  });

  it("has a distinct reviewer email prefix from the default profile", () => {
    expect(aie.reviewerEmailPrefix).not.toBe(PERF_PROFILES.default.reviewerEmailPrefix);
  });
});

describe("every PERF_PROFILES entry", () => {
  const profiles = Object.values(PERF_PROFILES);

  it("has a statusCounts that sums to exactly its submissionCount", () => {
    for (const profile of profiles) {
      const total = Object.values(profile.statusCounts).reduce((a, b) => a + b, 0);
      expect(total).toBe(profile.submissionCount);
    }
  });

  it("the default profile reproduces today's perf-2k numbers exactly", () => {
    const def = PERF_PROFILES.default;
    expect(def.submissionCount).toBe(2000);
    expect(def.contactCount).toBe(800);
    expect(def.trackCount).toBe(8);
    expect(def.answersPerSubmission).toBe(3);
    expect(def.statusCounts).toEqual({
      pending: 1200,
      accept_queue: 300,
      accepted: 300,
      decline_queue: 100,
      declined: 100,
    });
  });

  // DEC-645: the default profile's newly-threaded volumes must reproduce
  // today's PERF_ROOM_COUNT / PERF_REVIEWER_COUNT / plan literals exactly,
  // so existing perf budgets stay comparable across the change.
  it("the default profile's DEC-645 volumes reproduce today's DEC-088/DEC-338 literals bit-for-bit", () => {
    const def = PERF_PROFILES.default;
    expect(def.roomCount).toBe(10);
    expect(def.dayCount).toBe(3);
    expect(def.reviewerCount).toBe(12);
    expect(def.planCount).toBe(1);
    expect(def.planId).toBe("seed_perf_plan_0001");
    expect(def.reviewerEmailPrefix).toBe("perf.reviewer");
    expect(def.reviewerPassword).toBe("PerfReviewer!2027");
    expect(def.taskCount).toBe(4000);
    expect(def.overdueTaskFraction).toBe(0);
    expect(def.deliberateConflictCount).toBe(0);
  });
});

describe("profile event ids never collide", () => {
  it("default and aie have distinct event ids and slugs", () => {
    expect(PERF_PROFILES.default.eventId).not.toBe(PERF_PROFILES.aie.eventId);
    expect(PERF_PROFILES.default.eventSlug).not.toBe(PERF_PROFILES.aie.eventSlug);
  });

  it("both profiles' event ids stay inside the seed_perf_ id namespace (idempotent-delete coverage)", () => {
    for (const profile of Object.values(PERF_PROFILES)) {
      expect(profile.eventId.startsWith("seed_perf_")).toBe(true);
    }
  });
});

// DEC-338 (wave-35 amendment): the singleton perf speaker fixture that makes
// the speaker portal (/portal/*) measurable by perf-smoke.ts.
describe("perf speaker fixture (DEC-338 wave-35 amendment)", () => {
  it("the speaker user/contact ids stay inside the seed_perf_ id namespace (idempotent-delete coverage)", () => {
    expect(PERF_SPEAKER_USER_ID.startsWith("seed_perf_")).toBe(true);
    expect(PERF_SPEAKER_CONTACT_ID.startsWith("seed_perf_")).toBe(true);
  });

  it("the speaker credentials are non-empty and distinct from the reviewer/organizer credentials", () => {
    expect(PERF_SPEAKER_EMAIL.length).toBeGreaterThan(0);
    expect(PERF_SPEAKER_PASSWORD.length).toBeGreaterThan(0);
    expect(PERF_SPEAKER_EMAIL).not.toBe(PERF_PROFILES.default.reviewerEmailPrefix);
    expect(PERF_SPEAKER_PASSWORD).not.toBe(PERF_PROFILES.default.reviewerPassword);
  });

  it("perfSpeakerAcceptedIndexes is deterministic and idempotent across repeated calls (two 'seeds')", () => {
    const first = perfSpeakerAcceptedIndexes(300);
    const second = perfSpeakerAcceptedIndexes(300);
    expect(second).toEqual(first);
  });

  it("perfSpeakerAcceptedIndexes is bounded by both PERF_SPEAKER_SUBMISSION_COUNT and acceptedCount", () => {
    expect(perfSpeakerAcceptedIndexes(300)).toHaveLength(PERF_SPEAKER_SUBMISSION_COUNT);
    expect(perfSpeakerAcceptedIndexes(300).length).toBeLessThanOrEqual(300);
    // A profile seeded with fewer accepted submissions than the requested
    // count must never overrun acceptedCount.
    expect(perfSpeakerAcceptedIndexes(0)).toEqual([]);
  });

  // wave-39 correction: GET /api/v1/events/:id/submissions?status=accepted's
  // default "newest" sort returns createdAt desc, seq desc (highest-seq
  // first) — acceptedSubmissionIds is built in ASCENDING seed order, so the
  // returned index list must walk DOWN from acceptedCount-1, not up from 0,
  // for its own index 0 to line up with what page 1 actually returns first.
  it("perfSpeakerAcceptedIndexes returns descending indexes (highest-seq accepted submission first), pinning the page-1 'newest' sort contract", () => {
    expect(perfSpeakerAcceptedIndexes(2)).toEqual([1, 0]);
    expect(perfSpeakerAcceptedIndexes(300).slice(0, 3)).toEqual([299, 298, 297]);
  });

  it("perfSpeakerAcceptedIndexes always includes acceptedCount-1 (the highest-seq accepted submission) at its own index 0, whenever acceptedCount > 0 (so GET /portal/submissions/:id has a resolvable id matching icsIds[0])", () => {
    expect(perfSpeakerAcceptedIndexes(1)[0]).toBe(0);
    expect(perfSpeakerAcceptedIndexes(300)[0]).toBe(299);
  });

  it("perfSpeakerAcceptedIndexes rejects a non-integer or negative acceptedCount/count", () => {
    expect(() => perfSpeakerAcceptedIndexes(-1)).toThrow();
    expect(() => perfSpeakerAcceptedIndexes(1.5)).toThrow();
    expect(() => perfSpeakerAcceptedIndexes(300, -1)).toThrow();
  });

  it("perfSpeakerParticipantId is deterministic and idempotent across repeated calls", () => {
    expect(perfSpeakerParticipantId(1)).toBe(perfSpeakerParticipantId(1));
    expect(perfSpeakerParticipantId(1)).toBe("seed_perf_speaker_participant_0001");
    expect(perfSpeakerParticipantId(5)).toBe("seed_perf_speaker_participant_0005");
    expect(perfSpeakerParticipantId(1)).not.toBe(perfSpeakerParticipantId(2));
  });

  it("perfSpeakerParticipantId rejects a non-positive index", () => {
    expect(() => perfSpeakerParticipantId(0)).toThrow();
    expect(() => perfSpeakerParticipantId(-1)).toThrow();
  });

  it("perfSpeakerTaskAssignmentId is deterministic, idempotent, and bounded to PERF_TASK_COUNT rows", () => {
    const ids = Array.from({ length: PERF_TASK_COUNT }, (_, i) => perfSpeakerTaskAssignmentId(i));
    // Idempotent: calling again reproduces the same ids exactly.
    const idsAgain = Array.from({ length: PERF_TASK_COUNT }, (_, i) => perfSpeakerTaskAssignmentId(i));
    expect(idsAgain).toEqual(ids);
    // Bounded: exactly PERF_TASK_COUNT distinct ids, one per existing task.
    expect(new Set(ids).size).toBe(PERF_TASK_COUNT);
  });

  it("perfSpeakerTaskAssignmentId rejects a negative taskIndex", () => {
    expect(() => perfSpeakerTaskAssignmentId(-1)).toThrow();
  });

  it("isPerfSpeakerTaskAssignmentComplete mixes pending/complete across the speaker's PERF_TASK_COUNT assignments (not every row in one bucket)", () => {
    const statuses = Array.from({ length: PERF_TASK_COUNT }, (_, i) => isPerfSpeakerTaskAssignmentComplete(i));
    expect(statuses).toContain(true);
    expect(statuses).toContain(false);
    // Deterministic across repeated calls.
    expect(Array.from({ length: PERF_TASK_COUNT }, (_, i) => isPerfSpeakerTaskAssignmentComplete(i))).toEqual(
      statuses,
    );
  });
});
