import { describe, expect, it } from "vitest";
import {
  PERF_PROFILES,
  contactIndexForSubmission,
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
