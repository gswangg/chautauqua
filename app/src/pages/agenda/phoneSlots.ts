// Pure phone-agenda slot builder (DEC-380). Turns one room+day's placed
// sessions into a linear top-to-bottom run list for the phone tap-to-place
// view. No React import here, mirroring gridMath.ts's pure-function pattern
// so this stays unit-testable in isolation.

import type { AgendaConflict, PlacedAgendaSession } from './types';
import type { BlockedInterval } from '../../lib/schedule-vocabulary';

export interface PhoneSlot {
  startMin: number;
  endMin: number;
  kind: 'placed' | 'clash' | 'free' | 'blocked';
  sessions: PlacedAgendaSession[];
  /** Populated for `kind: 'blocked'` runs only (docs/design/Chautauqua
   * Agenda.dc.html:183 `{{ slot.note }}`), e.g. "Lunch · 60 min". */
  note?: string;
}

/** A break's blocked interval carrying the note its bordered phone row
 * draws (DEC-895 wave-32 amendment). Reuses BlockedInterval's day/startMin/
 * endMin shape rather than minting a second one -- PhoneAgenda.tsx already
 * builds a BlockedInterval[] from `breaks` for computeClashMove's `blocked`
 * scan; this is that same array with the note the same break row carries. */
export type PhoneBlockedInterval = BlockedInterval & { note: string };

export interface BuildPhoneSlotsArgs {
  placed: PlacedAgendaSession[];
  day: string;
  roomId: string | null;
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  conflicts: AgendaConflict[];
  /** The day's breaks, already reduced to blocked intervals + note. Defaults
   * to `[]` so existing callers/tests with no breaks fixture are unaffected. */
  breaks?: PhoneBlockedInterval[];
}

/**
 * Builds the phone agenda's linear slot list for one room on one day.
 *
 * Placed sessions in this room+day are swept in start-time order and
 * transitively merged wherever they overlap in time (the same interval
 * clustering the desktop grid's assignLanes uses for lane layout, DEC-140):
 * a cluster of one session is a `placed` run; a cluster of two or more is a
 * single `clash` run spanning the full union of their time, listing every
 * session in it (the phone view has no side-by-side lanes, so a clash is
 * one block, not stacked cards). Every gap between clusters — and before
 * the first / after the last — becomes exactly one `free` run regardless of
 * how many 15-minute grid rows it spans, so consecutive empty rows never
 * render as separate targets. `conflicts` mirrors the desktop grid's
 * server-truth conflict data (kept for callers such as PhoneAgenda that
 * flag individual sessions/rooms the same way SessionCard does); clash
 * grouping itself is derived from the placed sessions' actual time overlap,
 * which is guaranteed to agree with the server's room_overlap conflicts.
 */
export function buildPhoneSlots(args: BuildPhoneSlotsArgs): PhoneSlot[] {
  const { placed, day, roomId, dayStartMin, dayEndMin, breaks = [] } = args;

  const roomSessions = placed
    .filter((s) => s.day === day && s.roomId === roomId)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  interface Cluster {
    startMin: number;
    endMin: number;
    sessions: PlacedAgendaSession[];
  }

  const clusters: Cluster[] = [];
  for (const session of roomSessions) {
    const last = clusters[clusters.length - 1];
    if (last && session.startMin < last.endMin) {
      last.endMin = Math.max(last.endMin, session.endMin);
      last.sessions.push(session);
    } else {
      clusters.push({ startMin: session.startMin, endMin: session.endMin, sessions: [session] });
    }
  }

  // Sessions and breaks share ONE run-in-start-order sweep (a break is a
  // fourth occupied run, carved out of the free time exactly as a placed/
  // clash cluster is -- so consecutive free time still collapses to one
  // target either side, both before and after a break).
  type Run =
    | { kind: 'placed' | 'clash'; startMin: number; endMin: number; sessions: PlacedAgendaSession[]; note?: undefined }
    | { kind: 'blocked'; startMin: number; endMin: number; sessions?: undefined; note: string };

  const runs: Run[] = [
    ...clusters.map(
      (c): Run => ({
        kind: c.sessions.length >= 2 ? 'clash' : 'placed',
        startMin: c.startMin,
        endMin: c.endMin,
        sessions: c.sessions,
      }),
    ),
    ...breaks
      .filter((b) => b.day === day)
      .map((b): Run => ({ kind: 'blocked', startMin: b.startMin, endMin: b.endMin, note: b.note })),
  ].sort((a, b) => a.startMin - b.startMin);

  const slots: PhoneSlot[] = [];
  let cursor = dayStartMin;
  for (const run of runs) {
    if (run.startMin > cursor) {
      slots.push({ startMin: cursor, endMin: run.startMin, kind: 'free', sessions: [] });
    }
    slots.push({
      startMin: run.startMin,
      endMin: run.endMin,
      kind: run.kind,
      sessions: run.sessions ?? [],
      ...(run.note !== undefined ? { note: run.note } : {}),
    });
    cursor = Math.max(cursor, run.endMin);
  }
  if (cursor < dayEndMin) {
    slots.push({ startMin: cursor, endMin: dayEndMin, kind: 'free', sessions: [] });
  }

  return slots;
}
