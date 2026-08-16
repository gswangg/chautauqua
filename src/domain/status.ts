// Submission status pipeline (DEC-003 literals, DEC-009 semantics, DEC-699
// restores 'waitlisted' as a sixth literal — a HOLD, never decided).
// Hard invariant: this module contains ZERO email/mailer references — status
// changes never auto-send email. Callers decide whether to notify, separately.
import { DEC_699 } from "../decisions";
void DEC_699;

// DEC-180 wave-79 amendment: ONE declaration (the array), the type derived
// from it via `typeof ARR[number]` -- the idiom already in the tree at
// src/domain/acceptance.ts:162-171 -- instead of a type union and a value
// array separately re-listing the same six literals.
export const SUBMISSION_STATUSES = [
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "waitlisted",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** True for the two final (decided) statuses. */
export function isDecided(status: SubmissionStatus): boolean {
  return status === "accepted" || status === "declined";
}

export interface StatusChangeInput {
  status: SubmissionStatus;
  acceptedAt: number | null;
}

export interface StatusChangeResult {
  status: SubmissionStatus;
  acceptedAt: number | null;
  /**
   * True on every transition INTO 'accepted' from a non-accepted status
   * (DEC-278 wave-58 amendment) — not just the first one. Callers use this
   * flag to decide whether to run acceptance planning (see acceptance.ts);
   * it never triggers email itself. The planner is idempotent on
   * (contact, task-title), so re-running it on a re-accept is safe and is
   * what lets a co-speaker added after an accept -> un-accept -> re-accept
   * cycle still get onboarding tasks.
   */
  fireAcceptance: boolean;
  /**
   * True only when this transition actually STAMPS accepted_at, i.e. the
   * transition is into 'accepted' AND accepted_at was previously null.
   * accepted_at is still written exactly once and is never cleared by
   * un-accepting (DEC-009). Callers use this to gate the accepted_at column
   * write separately from the (broader) fireAcceptance flag.
   */
  setsAcceptedAt: boolean;
}

/**
 * Any status may move to any other status (Sessionboard's pill allows free
 * transitions). accepted_at is set exactly once, on first entry into
 * 'accepted', and is never cleared by un-accepting (DEC-009: un-accepting
 * does not delete created records). The onboarding PLANNER, however, runs on
 * every entry into 'accepted' (DEC-278 wave-58 amendment) — including
 * re-accepts — because it is idempotent on (contact, task-title): re-running
 * it after a co-speaker was added while un-accepted is what gives that
 * co-speaker onboarding tasks. This module keeps its zero-mailer invariant.
 */
export function changeStatus(
  current: StatusChangeInput,
  next: SubmissionStatus,
  now: number,
): StatusChangeResult {
  const entersAccepted = next === "accepted" && current.status !== "accepted";
  const stampsAcceptedAt = next === "accepted" && current.acceptedAt === null;
  const acceptedAt = stampsAcceptedAt ? now : current.acceptedAt;
  return {
    status: next,
    acceptedAt,
    fireAcceptance: entersAccepted,
    setsAcceptedAt: stampsAcceptedAt,
  };
}
