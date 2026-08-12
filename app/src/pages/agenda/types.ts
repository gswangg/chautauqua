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

export interface AgendaPayload {
  days: string[];
  rooms: AgendaRoom[];
  tracks: AgendaTrack[];
  placed: PlacedAgendaSession[];
  unscheduled: UnscheduledAgendaSession[];
  conflicts: AgendaConflict[];
  summary: AgendaSummary;
}

export interface RefreshedConflictsSummary {
  conflicts: AgendaConflict[];
  summary: AgendaSummary;
}
