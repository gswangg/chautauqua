// Overview worklist: pure (no I/O) conflict/placement helpers, unit-tested
// directly against row arrays — see test/overview.test.ts and
// test/overview-place-suggestion.test.ts. Split out of overview.ts (which
// grew past 800 lines and became a merge-conflict hotspot).

import type { BlockedInterval, Conflict, PlacedSession } from "../../../domain/schedule";
import { nextFreeSlot } from "../../../domain/schedule";
import { clockHMM } from "../../../domain/clock";
import { DEC_010, DEC_652, DEC_900 } from "../../../decisions";
import type { ConflictResolution, ConflictRow, ConflictSessionInfo, NextFreeSlotParams, PlacementSuggestion } from "./types";

void DEC_010;
void DEC_652;
void DEC_900;

const ROW_CAP = 5;

/** DEC-370 agendaWork.conflicts rows: one row per findConflicts() pair
 * (never re-derives conflicts itself), capped to ROW_CAP, resolved against
 * a pre-loaded session/room lookup — never queries inside the loop.
 * `resolution` is attached separately by attachConflictResolutions (DEC-652)
 * so this function and its existing unit tests stay untouched. */
export function buildConflictRows(
  conflicts: Conflict[],
  sessionById: Map<string, ConflictSessionInfo>,
  roomNameById: Map<string, string>,
  cap = ROW_CAP,
): Omit<ConflictRow, "resolution">[] {
  const rows: Omit<ConflictRow, "resolution">[] = [];
  for (const c of conflicts.slice(0, cap)) {
    const aId = c.submissionIds[0];
    if (aId === undefined) {
      throw new Error("buildConflictRows: submissionIds must carry at least one id");
    }
    const a = sessionById.get(aId);
    if (!a) {
      throw new Error(`buildConflictRows: session ${aId} not in the loaded set`);
    }

    if (c.kind === "break_overlap") {
      // DEC-557 (wave 69 amendment g): a break row is one session + the
      // break's own label — never "X and undefined".
      rows.push({
        day: a.day,
        startMin: a.startMin,
        endMin: a.endMin,
        roomName: a.roomId ? (roomNameById.get(a.roomId) ?? null) : null,
        kind: c.kind,
        entries: [{ submissionId: aId, ref: a.ref, title: a.title, speakerName: a.speakerName }],
      });
      continue;
    }

    const bId = c.submissionIds[1];
    if (bId === undefined) {
      throw new Error("buildConflictRows: room_overlap/speaker_overlap must carry two ids");
    }
    const b = sessionById.get(bId);
    if (!b) {
      throw new Error(`buildConflictRows: session ${bId} not in the loaded set`);
    }
    rows.push({
      day: a.day,
      startMin: a.startMin,
      endMin: a.endMin,
      roomName: a.roomId ? (roomNameById.get(a.roomId) ?? null) : null,
      kind: c.kind,
      entries: [
        { submissionId: aId, ref: a.ref, title: a.title, speakerName: a.speakerName },
        { submissionId: bId, ref: b.ref, title: b.title, speakerName: b.speakerName },
      ],
    });
  }
  return rows;
}

/** DEC-652/DEC-772: the concrete "place it" suggestion for one unplaced
 * submission — delegates to nextFreeSlot (the SAME candidate scan
 * autoSchedule runs), searching only the rooms/days already in use on the
 * event's placed sessions (no extra room/date query — getOverviewPayload's
 * own `placed` array already carries every room and day the event has
 * scheduled into). Null whenever nextFreeSlot finds nothing — never
 * invented. `durationMin` lets a caller pass the submission's own
 * format-derived length (src/server/repo/agenda.ts's
 * loadDurationMinBySubmission) so a suggested slot agrees with what
 * autoSchedule would actually place; omitted callers keep
 * params.defaultDurationMin, matching prior behaviour. */
export function buildPlacementSuggestion(
  speakerContactIds: string[],
  placed: PlacedSession[],
  rooms: string[],
  days: string[],
  roomNameById: Map<string, string>,
  params: NextFreeSlotParams,
  durationMin: number = params.defaultDurationMin,
  blocked: BlockedInterval[] = [],
): PlacementSuggestion | null {
  const slot = nextFreeSlot({
    session: {
      durationMin,
      speakerContactIds,
    },
    rooms,
    days,
    dayStartMin: params.dayStartMin,
    dayEndMin: params.dayEndMin,
    gridMin: params.gridMin,
    existing: placed,
    blocked,
  });
  if (!slot) return null;
  return {
    day: slot.day,
    startMin: slot.startMin,
    roomId: slot.roomId,
    roomName: roomNameById.get(slot.roomId) ?? slot.roomId,
    label: `Place at ${clockHMM(slot.startMin)}`,
  };
}

/** DEC-652: which of a conflict's pair is the one a resolution should move
 * — the LATER of the two (larger startMin; a same-startMin tie always
 * picks the pair's second/`b` entry, a fixed deterministic choice). */
export function pickLaterConflictEntry(
  aId: string,
  aStartMin: number,
  bId: string,
  bStartMin: number,
): string {
  return aStartMin > bStartMin ? aId : bId;
}

/** DEC-652: the concrete "move it" resolution for one conflict — moves the
 * LATER of the clashing pair (see pickLaterConflictEntry) into its own next
 * free slot via nextFreeSlot, searched in the SAME room it currently
 * occupies (falling back to every room already in use on the event when it
 * has none), excluding the moving submission itself from `existing` so it
 * never blocks its own search. Null whenever nextFreeSlot finds nothing. */
export function buildConflictResolutionFor(
  conflict: Conflict,
  sessionById: Map<string, ConflictSessionInfo>,
  placedById: Map<string, PlacedSession>,
  placed: PlacedSession[],
  fallbackRooms: string[],
  days: string[],
  roomNameById: Map<string, string>,
  params: NextFreeSlotParams,
  blocked: BlockedInterval[] = [],
): ConflictResolution | null {
  // DEC-557 (wave 69 amendment g): break_overlap has no second session to
  // "move it" against — returns the existing no-suggestion shape rather
  // than inventing a new resolution vocabulary.
  if (conflict.kind === "break_overlap") return null;

  const aId = conflict.submissionIds[0];
  const bId = conflict.submissionIds[1];
  if (aId === undefined || bId === undefined) {
    throw new Error("buildConflictResolutionFor: room_overlap/speaker_overlap must carry two ids");
  }
  const a = sessionById.get(aId);
  const b = sessionById.get(bId);
  if (!a || !b) {
    throw new Error(`buildConflictResolutionFor: session ${aId}/${bId} not in the loaded set`);
  }
  const laterId = pickLaterConflictEntry(aId, a.startMin, bId, b.startMin);
  const laterInfo = laterId === aId ? a : b;
  const laterPlacement = placedById.get(laterId);
  if (!laterPlacement) {
    throw new Error(`buildConflictResolutionFor: placement missing for ${laterId}`);
  }

  const rooms = laterPlacement.roomId ? [laterPlacement.roomId] : fallbackRooms;
  const slot = nextFreeSlot({
    session: { durationMin: laterPlacement.endMin - laterPlacement.startMin, speakerContactIds: laterPlacement.speakerContactIds },
    rooms,
    days,
    dayStartMin: params.dayStartMin,
    dayEndMin: params.dayEndMin,
    gridMin: params.gridMin,
    existing: placed.filter((p) => p.submissionId !== laterId),
    blocked,
  });
  if (!slot) return null;

  return {
    submissionId: laterId,
    ref: laterInfo.ref,
    day: slot.day,
    startMin: slot.startMin,
    roomId: slot.roomId,
    roomName: roomNameById.get(slot.roomId) ?? slot.roomId,
    label: `Move ${laterInfo.ref} to ${clockHMM(slot.startMin)}`,
  };
}
