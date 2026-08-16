// Conflict-label rendering shared by getAgendaPayload and
// getConflictsAndSummary (DEC-557: the ONE place a conflict becomes
// human-readable text).

import { describeConflict, type Conflict, type ConflictLabels } from "../../../domain/schedule";
import type { AcceptedSessionRow } from "./rows";
import type { DescribedConflict } from "./types";

/** DEC-557: builds the three label maps describeConflict needs from data the
 * callers already loaded — no extra queries beyond the caller-supplied
 * roomRows. */
export function buildConflictLabels(
  roomRows: { id: string; name: string }[],
  accepted: AcceptedSessionRow[],
): ConflictLabels {
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));
  const titleBySubmissionId = new Map(accepted.map((s) => [s.submissionId, s.title]));
  const speakerNameByContactId = new Map<string, string>();
  for (const s of accepted) {
    for (const speaker of s.speakers) {
      speakerNameByContactId.set(speaker.contactId, speaker.name);
    }
  }
  return { roomNameById, titleBySubmissionId, speakerNameByContactId };
}

export function describeConflicts(
  conflicts: Conflict[],
  labels: ConflictLabels,
): DescribedConflict[] {
  // DEC-851 wave-5 amendment: speakerContactIds/breakId/breakLabel are
  // consumed here (by describeConflict, below) but never put back on the
  // wire object -- they're inputs to `detail`, not facts the client reads
  // independently.
  return conflicts.map((c) => ({
    kind: c.kind,
    submissionIds: c.submissionIds,
    day: c.day,
    roomId: c.roomId,
    detail: describeConflict(c, labels),
  }));
}
