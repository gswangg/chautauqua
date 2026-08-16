// J6 onboarding tasks repo (DEC-023): the per-speaker detail read
// (GET /api/v1/events/:eventId/speakers/:contactId — DEC-930). Split out of
// repo/tasks.ts for contention decomposition (no behavior change) — see
// repo/tasks.ts's barrel header.
//
// DEC-930: the wire contract is normative and shared with the SPA task
// (w23-f) building the page against it — do not change these shapes without
// re-checking that decision.

import { and, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { overdueAssignmentConditions, rosterParticipantConditions } from "./crud";
import { safeExternalUrl } from "../../../domain/contacts";
import { parseSocialLinks } from "../profile";
import { parseContactCustomFields } from "../contacts/crud";
import { DEC_930, DEC_738 } from "../../../decisions";

void DEC_930; // this file is the ONE bounded GET DEC-930 mandates.
void DEC_738; // wave 75: the org-wide contact record (bio/socialLinks, alongside
// title/company/customFields) is projected here too -- the CRM drawer stays
// the one place it's edited (this record carries a link there, not a form).

// DEC-930 amendment (wave 26): cross-event history is a COUNT plus up to
// five names, never an unbounded query on a detail page.
const OTHER_EVENTS_LIMIT = 5;

export interface SpeakerDetailContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  hasAccount: boolean;
  phone: string | null;
  notes: string | null;
  // DEC-738 amendment (wave 71): the person's org-wide logistics facts
  // (dietary/travel/accessibility, plus any unreserved custom keys) live on
  // this same contact record and the CRM drawer edits them -- projected
  // here too so the speaker record is not a second, poorer view of the
  // same person. Parsed from contact.customFieldsJson; absent/blank is {},
  // never null.
  customFields: Record<string, string>;
  // Parsed out of contact.headshotUrl (stored as `/headshots/<fileId>` --
  // see repo/profile.ts) rather than a dedicated column, so this stays the
  // one place a headshot URL turns into a bare id.
  headshotFileId: string | null;
  // DEC-738 amendment (wave 75): the bio and social links the speaker wrote
  // through their portal profile (repo/profile.ts's updateProfile) are the
  // same org-wide contact facts the public speaker detail page projects
  // (repo/public/detail.ts) -- read the same way here so the organizer's
  // record isn't a poorer view of the person than the public page.
  bio: string | null;
  socialLinks: { label: string; url: string }[];
}

export interface SpeakerDetailOtherEvent {
  eventId: string;
  name: string;
}

export interface SpeakerDetailParticipation {
  participantId: string;
  submissionId: string;
  inviteStatus: string;
}

// DEC-936: the header's singular `participation` triple is an elected
// "primary" row and stays the ParticipationMenu's write target -- but a
// contact with more than one participation can disagree with itself across
// sessions, and the header must never assert a status the roster
// contradicts. This rollup is the person-level truth built from every
// participantRow the function already loads (no new query): the single
// shared status when every participation agrees, or the literal 'mixed'
// (never a highest/lowest-wins guess) plus one row per submission so the
// page can name each disagreement.
export interface SpeakerDetailParticipationRollupRow {
  participantId: string;
  submissionId: string;
  ref: string;
  inviteStatus: string;
}

export interface SpeakerDetailParticipationRollup {
  status: string;
  bySubmission: SpeakerDetailParticipationRollupRow[];
}

export interface SpeakerDetailScheduled {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
}

export interface SpeakerDetailSession {
  submissionId: string;
  ref: string;
  title: string;
  status: string;
  contentStatus: string;
  role: string;
  scheduled: SpeakerDetailScheduled | null;
}

export interface SpeakerDetailFile {
  id: string;
  filename: string;
  sizeBytes: number;
  versionNo: number | null;
}

export interface SpeakerDetailTask {
  assignmentId: string;
  taskId: string;
  title: string;
  kind: string;
  required: boolean;
  dueDate: number | null;
  status: string;
  completedAt: number | null;
  file: SpeakerDetailFile | null;
}

export interface SpeakerDetailCounts {
  outstandingRequired: number;
  overdue: number;
}

export interface SpeakerDetail {
  contact: SpeakerDetailContact;
  participation: SpeakerDetailParticipation;
  participationRollup: SpeakerDetailParticipationRollup;
  sessions: SpeakerDetailSession[];
  tasks: SpeakerDetailTask[];
  counts: SpeakerDetailCounts;
  otherEvents: SpeakerDetailOtherEvent[];
  otherEventsCount: number;
}

/** Builds the DEC-930 per-speaker detail payload for one contact on one
 * event, in a bounded number of queries independent of how many
 * sessions/tasks the contact has: (i) the contact + roster participation
 * rows (roster membership composes rosterParticipantConditions, DEC-829 —
 * returns null, "not on this event's roster", when empty); (ii) the event's
 * recordPrefix for session refs; (iii) one schedule-slot/room join for the
 * whole session set; (iv) one task_assignment/task/file join for the whole
 * task set (the SAME join shape grid.ts's cells query carries, never a
 * query per task); (v) the overdue count, composing the existing DEC-801
 * overdueAssignmentConditions predicate rather than re-typing its grace
 * window. Returns null when the contact is not on this event's roster. */
export async function getSpeakerDetail(db: Db, eventId: string, contactId: string): Promise<SpeakerDetail | null> {
  const contactRows = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      title: schema.contact.title,
      phone: schema.contact.phone,
      notes: schema.contact.notes,
      customFieldsJson: schema.contact.customFieldsJson,
      headshotUrl: schema.contact.headshotUrl,
      headshotFileId: schema.contact.headshotFileId,
      bio: schema.contact.bio,
      socialLinksJson: schema.contact.socialLinksJson,
      userId: schema.user.id,
    })
    .from(schema.contact)
    .leftJoin(schema.user, eq(schema.user.contactId, schema.contact.id))
    .where(eq(schema.contact.id, contactId))
    .limit(1);
  const contactRow = contactRows[0];
  if (!contactRow) return null;

  // Every participant row for this contact on an accepted submission of
  // this event (DEC-829's roster predicate) — the base of both the
  // singular `participation` triple and the `sessions` list.
  const participantRows = await db
    .select({
      participantId: schema.participant.id,
      submissionId: schema.participant.submissionId,
      inviteStatus: schema.participant.inviteStatus,
      role: schema.participant.role,
      submissionSeq: schema.submission.seq,
      submissionTitle: schema.submission.title,
      submissionStatus: schema.submission.status,
      submissionContentStatus: schema.submission.contentStatus,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .where(and(eq(schema.participant.contactId, contactId), rosterParticipantConditions(eventId)))
    .orderBy(schema.participant.id);

  if (participantRows.length === 0) return null;

  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix, timezone: schema.event.timezone })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix;
  const timeZone = eventRows[0]?.timezone;
  if (recordPrefix === undefined || timeZone === undefined) return null;

  const submissionIds = participantRows.map((p) => p.submissionId);
  const scheduledBySubmission = new Map<string, SpeakerDetailScheduled>();
  if (submissionIds.length > 0) {
    const slotRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomName: schema.room.name,
      })
      .from(schema.scheduleSlot)
      .leftJoin(schema.room, eq(schema.room.id, schema.scheduleSlot.roomId))
      .where(inArray(schema.scheduleSlot.submissionId, submissionIds));
    for (const r of slotRows) {
      scheduledBySubmission.set(r.submissionId, {
        day: r.day,
        startMin: r.startMin,
        endMin: r.endMin,
        roomName: r.roomName,
      });
    }
  }

  const sessions: SpeakerDetailSession[] = participantRows.map((p) => ({
    submissionId: p.submissionId,
    ref: formatRef(recordPrefix, p.submissionSeq),
    title: p.submissionTitle,
    status: p.submissionStatus,
    contentStatus: p.submissionContentStatus,
    role: p.role,
    scheduled: scheduledBySubmission.get(p.submissionId) ?? null,
  }));

  // DEC-936: the person-level rollup, built from the same participantRows
  // and refs `sessions` above already derived -- the single shared status
  // when every participation agrees, else the literal 'mixed'.
  const bySubmission: SpeakerDetailParticipationRollupRow[] = participantRows.map((p) => ({
    participantId: p.participantId,
    submissionId: p.submissionId,
    ref: formatRef(recordPrefix, p.submissionSeq),
    inviteStatus: p.inviteStatus,
  }));
  const distinctStatuses = new Set(bySubmission.map((r) => r.inviteStatus));
  const participationRollup: SpeakerDetailParticipationRollup = {
    status: distinctStatuses.size === 1 ? bySubmission[0]!.inviteStatus : "mixed",
    bySubmission,
  };

  // The one query for the whole task set — the same taskAssignment/task/file
  // join shape grid.ts's cells query carries (DEC-920), never a query per
  // task.
  const assignmentRows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      taskId: schema.taskAssignment.taskId,
      taskTitle: schema.task.title,
      taskKind: schema.task.kind,
      required: schema.task.required,
      dueDate: schema.task.dueDate,
      status: schema.taskAssignment.status,
      completedAt: schema.taskAssignment.completedAt,
      fileId: schema.taskAssignment.fileId,
      fileName: schema.file.filename,
      fileSizeBytes: schema.file.sizeBytes,
      fileVersionNo: schema.file.versionNo,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .leftJoin(schema.file, eq(schema.file.id, schema.taskAssignment.fileId))
    .where(and(eq(schema.taskAssignment.contactId, contactId), eq(schema.task.eventId, eventId)));

  let outstandingRequired = 0;
  const tasks: SpeakerDetailTask[] = assignmentRows.map((r) => {
    // schema.file.filename/sizeBytes are notNull columns (DEC-920) — a
    // non-null fileId whose file row didn't resolve through the join is a
    // broken reference, not a "no file" state. Fail loudly rather than
    // falling back to a generic "Has file" label (mirrors grid.ts).
    if (r.fileId != null && r.fileName == null) {
      throw new Error(`speaker detail: assignment ${r.assignmentId} has fileId ${r.fileId} that does not resolve to a file row`);
    }
    if (r.status !== "complete" && r.required) outstandingRequired += 1;
    return {
      assignmentId: r.assignmentId,
      taskId: r.taskId,
      title: r.taskTitle,
      kind: r.taskKind,
      required: r.required,
      dueDate: r.dueDate ? r.dueDate.getTime() : null,
      status: r.status,
      completedAt: r.completedAt ? r.completedAt.getTime() : null,
      file:
        r.fileId != null && r.fileName != null && r.fileSizeBytes != null
          ? { id: r.fileId, filename: r.fileName, sizeBytes: r.fileSizeBytes, versionNo: r.fileVersionNo }
          : null,
    };
  });

  const overdueRows = await db
    .select({ id: schema.taskAssignment.id })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
    .where(and(eq(schema.taskAssignment.contactId, contactId), overdueAssignmentConditions(eventId, Date.now(), timeZone)));

  // DEC-738 amendment (wave 75): parse the stored social_links_json and run
  // each non-empty value through safeExternalUrl (external-input boundary),
  // dropping anything unsafe/unparseable -- fixed label order regardless of
  // which fields are populated, mirroring repo/public/detail.ts exactly so
  // this isn't a second social-link vocabulary.
  const parsedSocial = parseSocialLinks(contactRow.socialLinksJson);
  const socialLinks: { label: string; url: string }[] = [];
  const socialFieldOrder: { label: string; key: keyof typeof parsedSocial }[] = [
    { label: "Twitter", key: "twitter" },
    { label: "LinkedIn", key: "linkedin" },
    { label: "GitHub", key: "github" },
    { label: "Website", key: "website" },
  ];
  for (const { label, key } of socialFieldOrder) {
    const safe = safeExternalUrl(parsedSocial[key]);
    if (safe !== null) socialLinks.push({ label, url: safe });
  }

  const primary = participantRows[0];
  if (!primary) throw new Error("speaker detail: participantRows unexpectedly empty after length check");

  // DEC-930 amendment (wave 26): cross-event history -- every OTHER event
  // (same org, since a contact never spans orgs) this contact has a
  // participant row on, one row per event via a DISTINCT-by-event pass in
  // JS (the join is still ONE query, never a query per event), newest
  // event first, capped to OTHER_EVENTS_LIMIT with the true count reported
  // separately rather than silently truncated.
  const otherEventRows = await db
    .select({
      eventId: schema.event.id,
      eventName: schema.event.name,
      eventStartDate: schema.event.startDate,
    })
    .from(schema.submission)
    .innerJoin(schema.participant, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(and(eq(schema.participant.contactId, contactId), ne(schema.submission.eventId, eventId)))
    .orderBy(schema.event.startDate);

  const otherEventsByEvent = new Map<string, { eventId: string; name: string; startDate: string }>();
  for (const r of otherEventRows) {
    if (!otherEventsByEvent.has(r.eventId)) {
      otherEventsByEvent.set(r.eventId, { eventId: r.eventId, name: r.eventName, startDate: r.eventStartDate });
    }
  }
  const otherEventsSorted = [...otherEventsByEvent.values()].sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
  const otherEvents: SpeakerDetailOtherEvent[] = otherEventsSorted
    .slice(0, OTHER_EVENTS_LIMIT)
    .map((e) => ({ eventId: e.eventId, name: e.name }));

  return {
    contact: {
      id: contactRow.id,
      name: `${contactRow.firstName} ${contactRow.lastName}`.trim(),
      email: contactRow.email,
      company: contactRow.company,
      title: contactRow.title,
      hasAccount: contactRow.userId != null,
      phone: contactRow.phone,
      notes: contactRow.notes,
      customFields: parseContactCustomFields(contactRow.customFieldsJson),
      // DEC-773 amendment (w32-e): headshotFileId is the single home for the
      // file id, always written together with headshotUrl (profile.ts's
      // setContactHeadshot, contacts/merge.ts, scripts/seed.ts) -- a non-null
      // url with a null fk is a violated invariant, not a "no headshot" state.
      headshotFileId: ((): string | null => {
        if (contactRow.headshotUrl === null) return null;
        if (contactRow.headshotFileId === null) {
          throw new Error(`speaker detail: contact ${contactRow.id} has headshotUrl but no headshotFileId`);
        }
        return contactRow.headshotFileId;
      })(),
      bio: contactRow.bio,
      socialLinks,
    },
    participation: {
      participantId: primary.participantId,
      submissionId: primary.submissionId,
      inviteStatus: primary.inviteStatus,
    },
    participationRollup,
    sessions,
    tasks,
    counts: {
      outstandingRequired,
      overdue: overdueRows.length,
    },
    otherEvents,
    otherEventsCount: otherEventsByEvent.size,
  };
}
