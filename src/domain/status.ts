// Submission status pipeline (DEC-003 literals, DEC-009 semantics, DEC-699
// restores 'waitlisted' as a sixth literal — a HOLD, never decided).
// Hard invariant: this module contains ZERO email/mailer references — status
// changes never auto-send email. Callers decide whether to notify, separately.
import { DEC_699 } from "../decisions";
void DEC_699;

export type SubmissionStatus =
  | "pending"
  | "accept_queue"
  | "decline_queue"
  | "accepted"
  | "declined"
  | "waitlisted";

export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "waitlisted",
];

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
   * True only on the transition into 'accepted' when accepted_at was
   * previously null — the idempotency guard from DEC-009. Callers use this
   * flag to decide whether to run acceptance planning (see acceptance.ts);
   * it never triggers email itself.
   */
  fireAcceptance: boolean;
}

/**
 * Any status may move to any other status (Sessionboard's pill allows free
 * transitions). accepted_at is set exactly once, on first entry into
 * 'accepted', and is never cleared by un-accepting (DEC-009: un-accepting
 * does not delete created records).
 */
export function changeStatus(
  current: StatusChangeInput,
  next: SubmissionStatus,
  now: number,
): StatusChangeResult {
  const enteringAcceptedFirstTime = next === "accepted" && current.acceptedAt === null;
  const acceptedAt = enteringAcceptedFirstTime ? now : current.acceptedAt;
  return {
    status: next,
    acceptedAt,
    fireAcceptance: enteringAcceptedFirstTime,
  };
}
