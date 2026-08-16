// Agenda data access (J9, DEC-021 payload contract). Route handlers in
// src/routes/agenda.ts call these; the pure conflict/auto-schedule engine
// lives in src/domain/schedule.ts (DEC-010). Track membership reads ONLY
// submission_track (DEC-017) — submission.track_id/additional_track_ids_json
// are frozen legacy and never touched here.
//
// This directory decomposes what was one 850-line file into cohesive
// submodules (days/types/labels/rows/payload/slots/auto-schedule); this
// index re-exports the full original public surface so every existing
// import of "../server/repo/agenda" (or "../../server/repo/agenda")
// continues to resolve unchanged.

export {
  isIsoDay,
  isDayWithinEventRange,
  dayOutsideEventRangeCondition,
  DEFAULT_AUTO_SCHEDULE_PARAMS,
} from "./days";

export type {
  DescribedConflict,
  DescribedUnplaced,
  AgendaSpeaker,
  AgendaSessionBase,
  PlacedAgendaSession,
  UnscheduledAgendaSession,
  AgendaRoom,
  AgendaTrack,
  AgendaPayload,
} from "./types";

export {
  getEventInfo,
  roomBelongsToEvent,
  getSubmissionOwnership,
  getSlotWriteContext,
  getRoomEventId,
  MAX_AGENDA_SCAN,
  loadDurationMinBySubmission,
} from "./rows";
export type { AcceptedSessionRow } from "./rows";

export {
  getAgendaPayload,
  listSlotsOutsideWindow,
  countPubliclyVisible,
  getConflictsAndSummary,
} from "./payload";

export { isValidSlotInput, upsertSlot, unscheduleSlot } from "./slots";
export type { SlotInput } from "./slots";

export { MAX_AUTO_SCHEDULE_PLACEMENTS, runAutoSchedule } from "./auto-schedule";
export type { AutoScheduleParams } from "./auto-schedule";
