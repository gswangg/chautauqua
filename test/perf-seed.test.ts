import { describe, expect, it } from "vitest";
import {
  PERF_ANSWERS_PER_SUBMISSION,
  PERF_CONTACT_COUNT,
  PERF_STATUS_COUNTS,
  PERF_SUBMISSION_COUNT,
  PERF_TOPICS,
  PERF_TRACK_COUNT,
  contactIndexForSubmission,
  perfSubmissionStatuses,
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
