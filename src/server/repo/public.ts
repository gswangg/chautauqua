// Public/embed repo layer (J10, DEC-022, DEC-274): the ONLY query source for
// the five public surfaces (/e/:eventSlug/*, /embed/:eventSlug/*).
//
// This file is a re-export barrel (contention-decomposition, no behavior
// change): the implementation lives in ./public/{gates,event,sessions,
// speakers,detail,agenda}.ts. Every symbol previously exported from this
// file is still exported from here, unchanged, so existing imports of
// "../repo/public" / "./public" keep working. New code may import directly
// from the submodules under ./public/ instead.
//
// - gates.ts: visibleSessionConditions/visibleParticipantConditions/
//   visibleSubmissionConditions/slotWithinEventRange (DEC-274 split gate).
// - event.ts: PublicEvent/getPublicEventBySlug, PublicTrack/getPublicTracks.
// - sessions.ts: PublicSpeaker/PublicSession/hydrateSessions (shared by
//   list/agenda/detail), getPublicSessions, getPublicSessionsByIds.
// - speakers.ts: getPublicSpeakers (directory/gallery).
// - detail.ts: getPublicSpeakerDetail, getPublicSessionDetail (DEC-151
//   drill-in pages).
// - agenda.ts: getPublicAgenda, getPublicAgendaByIds (DEC-310).

export {
  visibleSessionConditions,
  visibleParticipantConditions,
  visibleSubmissionConditions,
} from "./public/gates";

export {
  getPublicEventBySlug,
  getPublicEventById,
  getPublicTracks,
  getPublicCfpWindow,
  getPublicRooms,
  getPublicFormatOptions,
  getPriorPublicEvent,
} from "./public/event";
export type { PublicEvent, PublicTrack, PublicRoom } from "./public/event";

export { getPublicSessions, getPublicSessionsByIds } from "./public/sessions";
export type { PublicSpeaker, PublicSession, PublicSessionsPage } from "./public/sessions";

export { getPublicSpeakers } from "./public/speakers";
export type { PublicSpeakerWithSessions } from "./public/speakers";

export { getPublicSpeakerDetail, getPublicSessionDetail } from "./public/detail";
export type {
  PublicSpeakerDetailSession,
  PublicSpeakerDetail,
  PublicSessionDetail,
} from "./public/detail";

export { getPublicAgenda, getPublicAgendaByIds, getPublicScheduleDayCounts, getPublicBreaksByDay } from "./public/agenda";
export type { PublicAgendaItem } from "./public/agenda";
