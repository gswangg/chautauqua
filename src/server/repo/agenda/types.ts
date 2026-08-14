// Agenda payload shapes (DEC-021 payload contract).

import type { Conflict, UnplacedSession } from "../../../domain/schedule";

/** DEC-557: a Conflict plus its rendered prose, produced by describeConflict
 * — the ONE place a conflict becomes human-readable text. */
export type DescribedConflict = Conflict & { detail: string };

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
   * only runAutoSchedule populates this (getAgendaPayload's plain GET has
   * never run the placer, so it has no reasons to report). summary.unplaced
   * always counts ALL unplaced accepted sessions (DEC-021), a superset of
   * this list whenever a session has never been through auto-schedule. */
  unplacedReasons: DescribedUnplaced[];
  summary: { unplaced: number; conflicts: number };
}
