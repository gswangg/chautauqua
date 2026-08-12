// Overview worklist: pure (no I/O) conflict/placement helpers, unit-tested
// directly against row arrays — see test/overview.test.ts and
// test/overview-place-suggestion.test.ts. Split out of overview.ts (which
// grew past 800 lines and became a merge-conflict hotspot).

import type { Conflict, PlacedSession } from "../../../domain/schedule";
import { nextFreeSlot } from "../../../domain/schedule";
import { DEC_652 } from "../../../decisions";
import type { ConflictResolution, ConflictRow, ConflictSessionInfo, NextFreeSlotParams, PlacementSuggestion } from "./types";

void DEC_652;

const ROW_CAP = 5;

/** DEC-652: "10:00" / "11:30" — the plain (unpadded-hour, zero-padded
 * minute) 24h clock label the mock uses for §04's suggestion/resolution
 * buttons. Distinct from src/routes/public/cards.tsx's 12h AM/PM formatter
 * (a different surface's convention) and app/src/pages/agenda/gridMath.ts's
 * 12h am/pm formatter (the grid's own convention) — each rendering context
 * owns its own clock format per this file's existing per-context pattern. */
export function formatClockLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

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
    const [aId, bId] = c.submissionIds;
    const a = sessionById.get(aId);
    const b = sessionById.get(bId);
    if (!a || !b) {
      throw new Error(`buildConflictRows: session ${aId}/${bId} not in the loaded set`);
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

/** DEC-652: the concrete "place it" suggestion for one unplaced submission
 * — delegates to nextFreeSlot (the SAME candidate scan autoSchedule runs),
 * searching only the rooms/days already in use on the event's placed
 * sessions (no extra room/date query — getOverviewPayload's own `placed`
 * array already carries every room and day the event has scheduled into).
 * Null whenever nextFreeSlot finds nothing — never invented. */
export function buildPlacementSuggestion(
  leadSpeakerContactId: string | null,
  placed: PlacedSession[],
  rooms: string[],
  days: string[],
  roomNameById: Map<string, string>,
  params: NextFreeSlotParams,
): PlacementSuggestion | null {
  const slot = nextFreeSlot({
    session: {
      durationMin: params.defaultDurationMin,
      speakerContactIds: leadSpeakerContactId ? [leadSpeakerContactId] : [],
    },
    rooms,
    days,
    dayStartMin: params.dayStartMin,
    dayEndMin: params.dayEndMin,
    gridMin: params.gridMin,
    existing: placed,
  });
  if (!slot) return null;
  return {
    day: slot.day,
    startMin: slot.startMin,
    roomId: slot.roomId,
    roomName: roomNameById.get(slot.roomId) ?? slot.roomId,
    label: `Place at ${formatClockLabel(slot.startMin)}`,
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
): ConflictResolution | null {
  const [aId, bId] = conflict.submissionIds;
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
  });
  if (!slot) return null;

  return {
    submissionId: laterId,
    ref: laterInfo.ref,
    day: slot.day,
    startMin: slot.startMin,
    roomId: slot.roomId,
    roomName: roomNameById.get(slot.roomId) ?? slot.roomId,
    label: `Move ${laterInfo.ref} to ${formatClockLabel(slot.startMin)}`,
  };
}
