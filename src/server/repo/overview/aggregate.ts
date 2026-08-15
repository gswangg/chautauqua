// Overview worklist: pure (no I/O) aggregation helpers, unit-tested directly
// against row arrays — see test/overview.test.ts. Split out of overview.ts
// (which grew past 800 lines and became a merge-conflict hotspot).

import type { PlacedSession } from "../../../domain/schedule";
import { findConflicts } from "../../../domain/schedule";
import { assignmentDaysLate, effectiveAssignmentDueDate } from "../../../domain/task-due";
import type {
  OverviewPayload,
  FileRowForPick,
  LeadSpeakerRow,
  OverdueTaskRow,
  OverdueTaskInputRow,
} from "./types";

/** Reduces a grouped `status -> count` query result into the three DEC-030
 * triage buckets. Unknown/other statuses (e.g. accepted, declined) are
 * dropped — the triage card only tracks statuses still awaiting a decision.
 */
export function aggregateTriageCounts(
  rows: { status: string; n: number }[],
): OverviewPayload["triage-counts"] {
  const byStatus = new Map(rows.map((r) => [r.status, r.n]));
  return {
    pending: byStatus.get("pending") ?? 0,
    accept_queue: byStatus.get("accept_queue") ?? 0,
    decline_queue: byStatus.get("decline_queue") ?? 0,
  };
}

/** Agenda numbers: unplaced accepted submissions (DEC-370 wave-56
 * amendment: a SQL NOT EXISTS(schedule_slot) count, computed by the caller
 * — never a JS filter over a materialized accepted-id array) + schedule
 * conflicts (delegated to src/domain/schedule.ts findConflicts, DEC-010). */
export function computeAgendaSummary(
  unplacedCount: number,
  placed: PlacedSession[],
): OverviewPayload["agenda"] {
  return {
    unplaced: unplacedCount,
    conflicts: findConflicts(placed).length,
  };
}

/** Smallest non-null/non-undefined value, or null if every value is
 * missing — used across the DEC-370 deadlines strip (each cell tolerates a
 * null source independently). */
export function minNonNull(values: (number | null | undefined)[]): number | null {
  let min: number | null = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (min === null || v < min) min = v;
  }
  return min;
}

/** DEC-370/DEC-826 overdueTasks rows: derives the effective due date
 * (effectiveAssignmentDueDate — a task can't be late before it was
 * assigned) and attaches `daysLate` (DEC-801 wave 63 amendment:
 * assignmentDaysLate, the ONE count that agrees with the timezone-aware
 * isAssignmentOverdue predicate that selected this set — never the old
 * UTC-bare `Math.floor((now - dueDate) / DAY_MS)`, which could disagree
 * with that predicate at the day boundary and print "Due today" on a row
 * already selected as overdue). */
export function buildOverdueTaskRows(rows: OverdueTaskInputRow[], now: number, timeZone: string): OverdueTaskRow[] {
  return rows.map(({ taskDueDate, assignedAt, ...rest }) => {
    const dueDate = effectiveAssignmentDueDate(taskDueDate, assignedAt)!;
    return {
      ...rest,
      dueDate,
      daysLate: assignmentDaysLate(taskDueDate, assignedAt, now, timeZone),
    };
  });
}

/** DEC-558: picks the "latest file" per submission from a flat row list —
 * highest createdAt wins, ties broken by file.id ascending (a total order,
 * so re-feeding the same rows in any order yields byte-identical output).
 * Callers group rows by submissionId first; this picks within one group. */
export function pickLatestFilePerSubmission(rows: FileRowForPick[]): FileRowForPick | null {
  let best: FileRowForPick | null = null;
  for (const r of rows) {
    if (
      !best ||
      r.createdAt > best.createdAt ||
      (r.createdAt === best.createdAt && r.id < best.id)
    ) {
      best = r;
    }
  }
  return best;
}

/** DEC-558: picks the "lead speaker" per submission from a flat row list —
 * lowest participant.order wins, ties broken by contactId ascending (a
 * total order). Callers group rows by submissionId first; this picks
 * within one group. */
export function pickLeadSpeakerPerSubmission(rows: LeadSpeakerRow[]): LeadSpeakerRow | null {
  let best: LeadSpeakerRow | null = null;
  for (const r of rows) {
    if (
      !best ||
      r.order < best.order ||
      (r.order === best.order && r.contactId < best.contactId)
    ) {
      best = r;
    }
  }
  return best;
}
