// Pure optimistic-update helpers for the agenda page (DEC-021: HTML5
// drag-drop place/move/unschedule rendered optimistically, reconciled with
// the server response, rolled back loudly on ApiError). No React here so
// this is unit-testable in isolation.

import type { AgendaPayload, PlacedAgendaSession, RefreshedConflictsSummary } from './types';

export interface SlotPlacement {
  day: string;
  startMin: number;
  endMin: number;
  roomId: string | null;
}

/** Finds a session (placed or unscheduled) by submissionId, returning its
 * base fields (ref/title/trackIds/speakers) regardless of current location. */
function findBase(state: AgendaPayload, submissionId: string) {
  const inPlaced = state.placed.find((s) => s.submissionId === submissionId);
  if (inPlaced) return inPlaced;
  return state.unscheduled.find((s) => s.submissionId === submissionId) ?? null;
}

/**
 * Optimistically places (or moves) a submission into a slot: removes it from
 * unscheduled if present, and upserts it into placed with the new
 * day/room/time. Conflicts/summary are left untouched here — the caller
 * reconciles those from the server response once the write completes.
 */
export function placeOptimistically(
  state: AgendaPayload,
  submissionId: string,
  placement: SlotPlacement,
): AgendaPayload {
  const base = findBase(state, submissionId);
  if (!base) return state;

  const placedSession: PlacedAgendaSession = {
    submissionId: base.submissionId,
    ref: base.ref,
    title: base.title,
    trackIds: base.trackIds,
    speakers: base.speakers,
    roomId: placement.roomId,
    day: placement.day,
    startMin: placement.startMin,
    endMin: placement.endMin,
  };

  return {
    ...state,
    unscheduled: state.unscheduled.filter((s) => s.submissionId !== submissionId),
    placed: [...state.placed.filter((s) => s.submissionId !== submissionId), placedSession],
  };
}

/** Optimistically moves a placed submission back to the unscheduled tray. */
export function unscheduleOptimistically(state: AgendaPayload, submissionId: string): AgendaPayload {
  const base = findBase(state, submissionId);
  if (!base) return state;

  return {
    ...state,
    placed: state.placed.filter((s) => s.submissionId !== submissionId),
    unscheduled: [
      ...state.unscheduled.filter((s) => s.submissionId !== submissionId),
      { submissionId: base.submissionId, ref: base.ref, title: base.title, trackIds: base.trackIds, speakers: base.speakers },
    ],
  };
}

/** Merges a refreshed { conflicts, summary } response (from PUT/DELETE slot)
 * into state, leaving placed/unscheduled as already applied optimistically. */
export function reconcileConflictsSummary(
  state: AgendaPayload,
  refreshed: RefreshedConflictsSummary,
): AgendaPayload {
  return { ...state, conflicts: refreshed.conflicts, summary: refreshed.summary };
}
