// Pure helpers for scripts/perf-seed.ts, extracted for plain-vitest testing
// (same pattern as scripts/seed-lib.ts: dependency-free, no filesystem or D1
// access, safe to import without side effects). DEC-034.

/** Fixed id for the single synthetic perf event (not padded via seedId — it
 * is a singleton, not a numbered series). Starts with 'seed_perf_' so it is
 * covered by the same idempotent-delete namespace as every other perf row. */
export const PERF_EVENT_ID = "seed_perf_event";
export const PERF_EVENT_SLUG = "perf-2k";

export const PERF_SUBMISSION_COUNT = 2000;
export const PERF_CONTACT_COUNT = 800;
export const PERF_TRACK_COUNT = 8;
export const PERF_ANSWERS_PER_SUBMISSION = 3;

/** Realistic status mix across the 2,000 perf submissions (DEC-003 literals),
 * weighted toward 'pending' the way a real, actively-triaged CFP looks. */
export const PERF_STATUS_COUNTS: Readonly<Record<string, number>> = {
  pending: 1200,
  accept_queue: 300,
  accepted: 300,
  decline_queue: 100,
  declined: 100,
};

/**
 * Deterministic status list for the perf submissions, grouped by status
 * (block-distributed, not shuffled — deterministic and trivially testable;
 * downstream track/contact assignment is index-modulo so the resulting rows
 * still spread evenly regardless of block order).
 */
export function perfSubmissionStatuses(count: number): string[] {
  const total = Object.values(PERF_STATUS_COUNTS).reduce((a, b) => a + b, 0);
  if (count !== total) {
    throw new Error(`perfSubmissionStatuses: expected count ${total}, got ${count}`);
  }
  const out: string[] = [];
  for (const [status, n] of Object.entries(PERF_STATUS_COUNTS)) {
    for (let i = 0; i < n; i++) {
      out.push(status);
    }
  }
  return out;
}

/** Total submission_answer rows for N submissions at the fixed per-submission rate. */
export function totalPerfAnswerRows(submissionCount: number): number {
  if (!Number.isInteger(submissionCount) || submissionCount < 0) {
    throw new Error(`totalPerfAnswerRows: submissionCount must be a non-negative integer, got ${submissionCount}`);
  }
  return submissionCount * PERF_ANSWERS_PER_SUBMISSION;
}

/** 0-based contact index (into the 800-contact pool) for the i-th (0-based) submission. */
export function contactIndexForSubmission(i: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`contactIndexForSubmission: i must be a non-negative integer, got ${i}`);
  }
  return i % PERF_CONTACT_COUNT;
}

/** 0-based track index (into the 8-track pool) for the i-th (0-based) submission. */
export function trackIndexForSubmission(i: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`trackIndexForSubmission: i must be a non-negative integer, got ${i}`);
  }
  return i % PERF_TRACK_COUNT;
}
