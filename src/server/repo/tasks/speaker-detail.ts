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
import { chunkIds } from "../../../lib/chunk"; // DEC-078
import { HEADSHOT_KIND } from "../files-library-scope";
import { fetchReminderSendInstants, remindSendsInWindow } from "./task-view";
import { DEC_930, DEC_738, DEC_829 } from "../../../decisions";

void DEC_930; // this file is the ONE bounded GET DEC-930 mandates.
void DEC_829; // rail row is two lines, rail empty state is one line
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
  // DEC-829 wave-110 amendment: the rail's second line ("Spoke · <title>",
  // "Submitted, declined") -- derived from the SAME submission row already
  // grouped below, never a second query. Absent when that submission has no
  // decided state to speak of (pending/accept_queue/decline_queue/waitlisted),
  // rather than inventing a line for an undecided outcome.
  participation: string | null;
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
  // DEC-930 (amendment, wave 115): a Files row states WHO put the file there
  // and WHEN, for every file the section lists. Both come off the file row
  // itself (schema.file.createdAt / uploadedByContactId); uploaderName
  // resolves through the same one chunked contact lookup the headshot row
  // uses, and is null when the column is null rather than guessing at the
  // speaker (files-library-list.ts falls back to the owning speaker's name
  // for a HEADSHOT, where ownership makes that true; a task file has no such
  // guarantee).
  uploadedAt: number;
  uploaderName: string | null;
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
  // User-filed (speaker detail, Elliot Ekström): the detail page's own
  // header counted "1 overdue" while every pending row rendered identically,
  // because lateness was only ever a COUNT on this payload. The per-row flag
  // is derived from the SAME overdueAssignmentConditions result set the
  // count is (see below), so a row and the header can never disagree; the
  // client cannot re-derive it (DEC-801 judges lateness against the
  // assignment's creation in the EVENT's timezone, neither of which crosses
  // this wire).
  overdue: boolean;
  // Design pack v12 (wave 118 amendment): the row's Remind link carries an
  // ordinal ("Remind · never sent" / "sent once" / "Nth time"), which needs
  // a per-assignment SEND COUNT -- derived here via remindSendsInWindow
  // (task-view.ts), the SAME >=created/<completed windowing rule
  // countRemindSends applies for the roster-of-a-task shape. Not a fabricated
  // tally: email_log genuinely carries no taskId, but a reminder email lists
  // every outstanding task its recipient held at send time, so a send inside
  // this assignment's active window necessarily named this task.
  remindCount: number;
}

export interface SpeakerDetailCounts {
  outstandingRequired: number;
  overdue: number;
  // Design pack v12 (wave 118 amendment): the header's "Reminded N× · last
  // <date>" caption's N -- every reminder email this contact received on
  // this event, across every task, per fetchReminderSendInstants
  // (task-view.ts). Unlike the per-task remindCount above this is NOT
  // windowed per assignment: one send can (and usually does) name several
  // outstanding tasks at once, so summing the per-task counts would count
  // that one email multiple times.
  remindCount: number;
}

// DEC-930 (amendment, wave 115): the portal-uploaded headshot IS a file
// object -- schema.file carries its filename, sizeBytes, uploader and
// createdAt exactly as it does for a task upload (repo/profile.ts's
// setContactHeadshot writes all four) -- and the organizer's record listed
// none of it, rendering only an avatar and a bare "Download". Projected here
// so the Files section can list it like any other row. There is NO version
// chain: setContactHeadshot never sets previousFileId, so a new upload is an
// unlinked row and the old one simply stops being referenced -- versionNo is
// whatever the row stores and no history is invented for it (DEC-669 keeps
// headshots out of the deliverable chain query for the same reason).
export interface SpeakerDetail {
  contact: SpeakerDetailContact;
  headshotFile: SpeakerDetailFile | null;
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
 * query per task); (v) the overdue set, composing the existing DEC-801
 * overdueAssignmentConditions predicate rather than re-typing its grace
 * window — read once and spent twice, as the header count AND each task's
 * own `overdue` flag; (vi) DEC-930 (amendment, wave 115) the headshot's own
 * file row, ONE single-row read scoped to kind='headshot', skipped entirely
 * when the contact has no headshot; (vii) the uploader names for every file
 * this payload lists, one chunked read (DEC-078) over the DISTINCT uploader
 * ids other than the speaker themselves — skipped when there are none, which
 * is the common case; (viii) design pack v12 (wave 118 amendment) every
 * reminder-email instant this contact received on this event
 * (fetchReminderSendInstants, task-view.ts), read once and spent twice as
 * the per-task remindCount (windowed per assignment) and the header's
 * person-level remindCount (unwindowed — see SpeakerDetailCounts). Returns
 * null when the contact is not on this event's roster. */
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
      // Design pack v12 (wave 118 amendment): the assignment's active-window
      // start, so remindSendsInWindow can bound the per-task remindCount the
      // same way countRemindSends bounds it in SQL for the roster-of-a-task
      // shape.
      createdAt: schema.taskAssignment.createdAt,
      fileId: schema.taskAssignment.fileId,
      // Design pack v12: the detail's task rows carry a reminder-history
      // qualifier ("Remind · never sent" / "Remind · last 4 Aug") in place of
      // the bare "Remind this task". This column is the ONLY reminder fact
      // the schema records per assignment -- there is no send COUNT anywhere
      // (email_log records a contact and a sent_at but no task), so the row
      // states the last send, never an invented tally. See SpeakerDetailPage
      // .tsx's taskRemindLabel.
      lastRemindedAt: schema.taskAssignment.lastRemindedAt,
      fileName: schema.file.filename,
      fileSizeBytes: schema.file.sizeBytes,
      fileVersionNo: schema.file.versionNo,
      // DEC-930 (amendment, wave 115): a Files row names its uploader and its
      // timestamp -- read off the SAME join, never a query per file.
      fileUploadedAt: schema.file.createdAt,
      fileUploadedByContactId: schema.file.uploadedByContactId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .leftJoin(schema.file, eq(schema.file.id, schema.taskAssignment.fileId))
    .where(and(eq(schema.taskAssignment.contactId, contactId), eq(schema.task.eventId, eventId)));

  // The ONE lateness read for this payload (DEC-801): it feeds both the
  // header count and each row's own overdue flag, so the two are the same
  // fact stated twice, never two derivations that can drift apart.
  const overdueRows = await db
    .select({ id: schema.taskAssignment.id })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
    .where(and(eq(schema.taskAssignment.contactId, contactId), overdueAssignmentConditions(eventId, Date.now(), timeZone)));
  const overdueAssignmentIds = new Set(overdueRows.map((r) => r.id));

  // Design pack v12 (wave 118 amendment): every reminder-email instant this
  // contact received on this event -- the raw material for both the
  // per-task remindCount (windowed below) and the header's person-level
  // total (counts.remindCount), from the ONE shared reader task-view.ts
  // already derives this domain from.
  const reminderSendInstants = await fetchReminderSendInstants(db, eventId, contactId);

  // DEC-773 amendment (w32-e): headshotFileId is the single home for the file
  // id, always written together with headshotUrl (profile.ts's
  // setContactHeadshot, contacts/merge.ts, scripts/seed.ts) -- a non-null url
  // with a null fk is a violated invariant, not a "no headshot" state.
  const headshotFileId = ((): string | null => {
    if (contactRow.headshotUrl === null) return null;
    if (contactRow.headshotFileId === null) {
      throw new Error(`speaker detail: contact ${contactRow.id} has headshotUrl but no headshotFileId`);
    }
    return contactRow.headshotFileId;
  })();

  // DEC-930 (amendment, wave 115): ONE single-row read for the headshot's own
  // file row, so the Files section can list it with the filename/uploader/
  // timestamp every other file row now carries. Scoped to kind='headshot'
  // (HEADSHOT_KIND, the same predicate getHeadshotServeScope applies) so this
  // can never widen into a general file-by-id read.
  const headshotFileRows = headshotFileId
    ? await db
        .select({
          id: schema.file.id,
          filename: schema.file.filename,
          sizeBytes: schema.file.sizeBytes,
          versionNo: schema.file.versionNo,
          createdAt: schema.file.createdAt,
          uploadedByContactId: schema.file.uploadedByContactId,
        })
        .from(schema.file)
        .where(and(eq(schema.file.id, headshotFileId), eq(schema.file.kind, HEADSHOT_KIND)))
    : [];

  // DEC-078: the uploader names for every file this payload lists, in one
  // chunked read over the DISTINCT uploader ids -- bounded by the contact's
  // own task count, never a per-file query and never a whole-org scan. The
  // speaker themselves is the overwhelmingly common uploader and is resolved
  // from the row already in hand.
  const speakerName = `${contactRow.firstName} ${contactRow.lastName}`.trim();
  const uploaderIds = new Set<string>();
  for (const r of assignmentRows) {
    if (r.fileUploadedByContactId != null && r.fileUploadedByContactId !== contactId) uploaderIds.add(r.fileUploadedByContactId);
  }
  for (const h of headshotFileRows) {
    if (h.uploadedByContactId != null && h.uploadedByContactId !== contactId) uploaderIds.add(h.uploadedByContactId);
  }
  const uploaderNameById = new Map<string, string>([[contactId, speakerName]]);
  for (const batch of chunkIds([...uploaderIds])) {
    const rows = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const r of rows) uploaderNameById.set(r.id, `${r.firstName} ${r.lastName}`.trim());
  }
  /** Null (rendered as an honest dash) rather than a guess when the file row
   * records no uploader -- see SpeakerDetailFile's doc comment. */
  const uploaderNameOf = (uploadedByContactId: string | null): string | null =>
    uploadedByContactId === null ? null : (uploaderNameById.get(uploadedByContactId) ?? null);

  const headshotFile: SpeakerDetailFile | null = ((): SpeakerDetailFile | null => {
    const row = headshotFileRows[0];
    if (!row) return null;
    return {
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      versionNo: row.versionNo,
      uploadedAt: row.createdAt.getTime(),
      // A headshot's owner IS the speaker whose record this is, so an
      // unattributed row still truthfully reads as theirs -- the same
      // fallback files-library-list.ts applies to the admin Files library.
      uploaderName: uploaderNameOf(row.uploadedByContactId) ?? speakerName,
    };
  })();

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
      lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
      file:
        r.fileId != null && r.fileName != null && r.fileSizeBytes != null && r.fileUploadedAt != null
          ? {
              id: r.fileId,
              filename: r.fileName,
              sizeBytes: r.fileSizeBytes,
              versionNo: r.fileVersionNo,
              uploadedAt: r.fileUploadedAt.getTime(),
              uploaderName: uploaderNameOf(r.fileUploadedByContactId ?? null),
            }
          : null,
      overdue: overdueAssignmentIds.has(r.assignmentId),
      remindCount: remindSendsInWindow(reminderSendInstants, r.createdAt.getTime(), r.completedAt ? r.completedAt.getTime() : null),
    };
  });

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
      submissionTitle: schema.submission.title,
      submissionStatus: schema.submission.status,
    })
    .from(schema.submission)
    .innerJoin(schema.participant, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(and(eq(schema.participant.contactId, contactId), ne(schema.submission.eventId, eventId)))
    .orderBy(schema.event.startDate);

  const otherEventsByEvent = new Map<string, { eventId: string; name: string; startDate: string; participation: string | null }>();
  for (const r of otherEventRows) {
    if (!otherEventsByEvent.has(r.eventId)) {
      let participation: string | null;
      if (r.submissionStatus === "accepted") {
        participation = `Spoke · ${r.submissionTitle}`;
      } else if (r.submissionStatus === "declined") {
        participation = "Submitted, declined";
      } else {
        participation = null;
      }
      otherEventsByEvent.set(r.eventId, { eventId: r.eventId, name: r.eventName, startDate: r.eventStartDate, participation });
    }
  }
  const otherEventsSorted = [...otherEventsByEvent.values()].sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
  const otherEvents: SpeakerDetailOtherEvent[] = otherEventsSorted
    .slice(0, OTHER_EVENTS_LIMIT)
    .map((e) => ({ eventId: e.eventId, name: e.name, participation: e.participation }));

  return {
    contact: {
      id: contactRow.id,
      name: speakerName,
      email: contactRow.email,
      company: contactRow.company,
      title: contactRow.title,
      hasAccount: contactRow.userId != null,
      phone: contactRow.phone,
      notes: contactRow.notes,
      customFields: parseContactCustomFields(contactRow.customFieldsJson),
      headshotFileId,
      bio: contactRow.bio,
      socialLinks,
    },
    participation: {
      participantId: primary.participantId,
      submissionId: primary.submissionId,
      inviteStatus: primary.inviteStatus,
    },
    headshotFile,
    participationRollup,
    sessions,
    tasks,
    counts: {
      outstandingRequired,
      overdue: overdueRows.length,
      remindCount: reminderSendInstants.length,
    },
    otherEvents,
    otherEventsCount: otherEventsByEvent.size,
  };
}
