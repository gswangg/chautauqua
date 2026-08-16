// Public/embed repo layer (J10, DEC-022, DEC-274): shared visibility gates.
// DEC-274 splits the visibility gate into two distinct conditions: session
// gates (submission.status='accepted' AND submission.content_status=
// 'approved', via visibleSessionConditions() — no reference to participant)
// and participant gates (participant.visible=1 AND participant.invite_status
// IN ('none','accepted'), DEC-108, via visibleParticipantConditions()).
// Session-rooted queries (list/agenda/detail) use visibleSessionConditions()
// alone and left-join participant — a session with zero participants, or
// whose participants are all hidden, is still publicly visible with
// speakers: []. Speaker-rooted queries (getPublicSpeakers/
// getPublicSpeakerDetail) still use visibleSubmissionConditions(), the AND
// of both gates, since a hidden/uninvited participant must never appear as
// a speaker.

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import * as schema from "../../../db/schema";

/**
 * Session-only visibility gate (DEC-274): submission.status='accepted' AND
 * submission.content_status='approved'. Contains NO reference to
 * schema.participant — a session with zero participants, or whose
 * participants are all hidden, still satisfies this gate. Use this (not
 * visibleSubmissionConditions()) for every session-rooted public query.
 */
export function visibleSessionConditions() {
  return and(eq(schema.submission.status, "accepted"), eq(schema.submission.contentStatus, "approved"));
}

/**
 * Participant-only visibility gate (DEC-274, DEC-108): participant.visible=1
 * AND participant.invite_status IN ACTIVE_INVITE_STATUSES ('none','accepted')
 * — 'none' is the never-invited (solo/no-coordination) case, 'accepted' is
 * invite-accepted; any other invite state must never make a participant
 * publicly visible. Composes the declared constant (src/domain/acceptance.ts)
 * rather than re-typing the literal pair — DEC-180 wave-75 amendment: a
 * hand-inlined SQL literal here would silently stop tracking a change to the
 * declared constant. Callers must join `participant` for this to apply.
 */
export function visibleParticipantConditions() {
  return and(
    eq(schema.participant.visible, true),
    inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES as readonly string[]),
  );
}

/**
 * Single-sourced visibility condition (DEC-022, DEC-274): the AND of the
 * session gate and the participant gate. Callers MUST join `participant`
 * into the query (innerJoin on participant.submissionId = submission.id)
 * for the participant.visible check to apply. Use this only for
 * speaker-rooted queries (getPublicSpeakers/getPublicSpeakerDetail) — a
 * hidden/uninvited participant must never appear as a speaker. Session-
 * rooted queries must use visibleSessionConditions() instead, so a
 * speakerless or all-hidden-speaker session remains publicly visible.
 */
export function visibleSubmissionConditions() {
  return and(visibleSessionConditions(), visibleParticipantConditions());
}

/**
 * DEC-318: bounds a schedule_slot read to the event's own [startDate,
 * endDate] range. A slot dated outside this range must never publish —
 * the session it belongs to instead renders as unscheduled (all schedule
 * fields null). Kept in the SQL WHERE per DEC-312, never a post-filter in
 * the mapper, so page counts / embed JSON / .ics bodies all agree.
 */
export function slotWithinEventRange(event: { startDate: string; endDate: string }) {
  return and(gte(schema.scheduleSlot.day, event.startDate), lte(schema.scheduleSlot.day, event.endDate));
}
