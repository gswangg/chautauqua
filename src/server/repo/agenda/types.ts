// Agenda payload shapes (DEC-021 payload contract).

import type { Conflict, UnplacedSession } from "../../../domain/schedule";

/** DEC-557: a Conflict plus its rendered prose, produced by describeConflict
 * — the ONE place a conflict becomes human-readable text. speakerContactIds/
 * breakId/breakLabel are Conflict-internal inputs describeConflict already
 * folded into `detail`; the wire shape drops them (DEC-851 wave-5
 * amendment: an unread wire field is a lie) rather than shipping the raw
 * inputs alongside the prose they were spent to produce. */
export type DescribedConflict = Omit<Conflict, "speakerContactIds" | "breakId" | "breakLabel"> & {
  detail: string;
};

/** DEC-615: an UnplacedSession plus its rendered prose from describeUnplaced
 * and the duration that reason was computed against — the agenda payload's
 * one place an auto-schedule run's unplaced reasons become human-readable. */
export type DescribedUnplaced = UnplacedSession & { durationMin: number; detail: string };

export interface AgendaSpeaker {
  contactId: string;
  name: string;
}

export interface AgendaSessionBase {
  submissionId: string;
  ref: string;
  title: string;
  trackIds: string[];
  speakers: AgendaSpeaker[];
}

export interface PlacedAgendaSession extends AgendaSessionBase {
  roomId: string | null;
  day: string;
  startMin: number;
  endMin: number;
}

export type UnscheduledAgendaSession = AgendaSessionBase;

export interface AgendaRoom {
  id: string;
  name: string;
}

export interface AgendaTrack {
  id: string;
  name: string;
  color: string | null;
}

export interface AgendaPayload {
  days: string[];
  rooms: AgendaRoom[];
  tracks: AgendaTrack[];
  placed: PlacedAgendaSession[];
  unscheduled: UnscheduledAgendaSession[];
  conflicts: DescribedConflict[];
  /** DEC-615: per-item reasons from the most recent auto-schedule run —
   * only runAutoSchedule populates this (getAgendaPayload's plain GET
   * returns unplacedReasons: [], so summary.unplaced is a superset of the
   * (empty) list there, since the placer has never run). DEC-615 (wave 43
   * amendment): after runAutoSchedule, this list is NOT a superset relation
   * — it is exactly equal in length to summary.unplaced, because both derive
   * from the same loadAcceptedSessions read and the same
   * isDayWithinEventRange predicate (runAutoSchedule asserts this equality
   * and throws on divergence). */
  unplacedReasons: DescribedUnplaced[];
  // DEC-899: placed/total are the SAME numerator/denominator the SPA's
  // "P% placed" reads — computed once here (domain/schedule.ts's
  // scheduleSummary), never re-derived client-side from placed.length.
  summary: { unplaced: number; conflicts: number; placed: number; total: number };
}
