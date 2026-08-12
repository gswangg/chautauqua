// Pure phone-agenda slot builder (DEC-380). Turns one room+day's placed
// sessions into a linear top-to-bottom run list for the phone tap-to-place
// view. No React import here, mirroring gridMath.ts's pure-function pattern
// so this stays unit-testable in isolation.

import type { AgendaConflict, PlacedAgendaSession } from './types';

export interface PhoneSlot {
  startMin: number;
  endMin: number;
  kind: 'placed' | 'clash' | 'free';
  sessions: PlacedAgendaSession[];
}

export interface BuildPhoneSlotsArgs {
  placed: PlacedAgendaSession[];
  day: string;
  roomId: string | null;
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  conflicts: AgendaConflict[];
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
  const { placed, day, roomId, dayStartMin, dayEndMin } = args;

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

  const slots: PhoneSlot[] = [];
  let cursor = dayStartMin;
  for (const cluster of clusters) {
    if (cluster.startMin > cursor) {
      slots.push({ startMin: cursor, endMin: cluster.startMin, kind: 'free', sessions: [] });
    }
    slots.push({
      startMin: cluster.startMin,
      endMin: cluster.endMin,
      kind: cluster.sessions.length >= 2 ? 'clash' : 'placed',
      sessions: cluster.sessions,
    });
    cursor = cluster.endMin;
  }
  if (cursor < dayEndMin) {
    slots.push({ startMin: cursor, endMin: dayEndMin, kind: 'free', sessions: [] });
  }

  return slots;
}
