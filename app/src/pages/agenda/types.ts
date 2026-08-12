// Shared shapes mirroring the DEC-021 GET .../agenda payload. Kept local to
// the SPA (not imported from src/server) since the SPA only ever sees JSON.

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

export interface AgendaConflict {
  kind: 'room_overlap' | 'speaker_overlap';
  submissionIds: [string, string];
  day: string;
  roomId: string | null;
  speakerContactIds: string[];
  detail: string;
}

export interface AgendaSummary {
  unplaced: number;
  conflicts: number;
}

// DEC-615: closed vocabulary mirroring src/domain/schedule.ts's
// UnplacedReason — the SPA never invents a reason, it only renders one
// already computed server-side.
export type UnplacedReason = 'no_rooms_configured' | 'duration_exceeds_day' | 'no_free_slot' | 'speaker_double_booked';

export interface DescribedUnplaced {
  submissionId: string;
  reason: UnplacedReason;
  durationMin: number;
  detail: string;
}

export interface AgendaPayload {
  days: string[];
  rooms: AgendaRoom[];
  tracks: AgendaTrack[];
  placed: PlacedAgendaSession[];
  unscheduled: UnscheduledAgendaSession[];
  conflicts: AgendaConflict[];
  /** DEC-615: per-item reasons from the most recent auto-schedule run —
   * empty until auto-schedule has run this session. */
  unplacedReasons: DescribedUnplaced[];
  summary: AgendaSummary;
}

export interface RefreshedConflictsSummary {
  conflicts: AgendaConflict[];
  summary: AgendaSummary;
}
