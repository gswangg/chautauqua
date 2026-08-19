// Organizer participant-management repo (DEC-070): invite a participant
// onto an existing submission, and toggle a participant's public
// visibility. This module deliberately contains NO mail/mailer import —
// per product principle 4 (communications are deliberate, not automatic),
// creating an invitation NEVER sends email; notifying the invitee is a
// separate, explicit action via the existing compose flow. Verified by a
// source-scan test in test/api-participants.test.ts (DEC-009-style
// tripwire).

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { DEC_070, DEC_258, DEC_556, DEC_604 } from "../../decisions";
import { chunkIds, chunkRowsForInsert } from "../../lib/chunk";
import { touchSubmissions } from "./submissions/touch";
import {
  MAX_PARTICIPANTS_PER_SUBMISSION,
  DEFAULT_PARTICIPANT_ROLE,
} from "../../domain/participant-roles";
import { participantCapRefusalMessage } from "../../domain/cap-copy";
import { ApiError } from "../http";

// Compile-checked dependency marker: this module implements DEC_070's
// endpoint contract (invite shape, duplicate rejection, visibility toggle).
void DEC_070;
// inviteParticipant below snapshots DEC-258's title_at_time/org_at_time
// from the caller-supplied contact attribution.
void DEC_258;
// DEC-556: (submission_id, contact_id) uniqueness is a real database
// constraint (migrations/0019_join_table_uniqueness.sql); inviteParticipant
// below is a single INSERT ... ON CONFLICT DO NOTHING, never a
// select-then-insert.
void DEC_556;
// DEC-604 amendment (findings wave 15, task-w15-b): insertActiveParticipants
// below asserts MAX_PARTICIPANTS_PER_SUBMISSION BEFORE writing, closing the
// CSV-roster-import door (src/server/repo/contacts/push.ts's
// pushContactsToEvent) against the cap the organizer-invite and
// add-co-presenter doors already enforced.
void DEC_604;

/** Sentinel returned by inviteParticipant when the (submissionId, contactId)
 * pair already has a participant row — callers surface this as an
 * ApiError('invalid', ..., { contactId: ... }). */
export const DUPLICATE_PARTICIPANT = "duplicate" as const;

/** Sentinel returned by inviteParticipant when the submission is already at
 * MAX_PARTICIPANTS_PER_SUBMISSION (DEC-422/DEC-604 amendment: the cap is a
 * property of the SUBMISSION, enforced at BOTH doors that can add a
 * participant row — this organizer door and the speaker portal's
 * addCoPresenter, src/server/repo/portal-edit.ts). Callers surface this as
 * an ApiError('invalid', ...) built through
 * src/domain/cap-copy.ts:participantCapRefusalMessage, never a bare count. */
export const OVER_CAP = "over_cap" as const;

export interface InviteParticipantInput {
  submissionId: string;
  contactId: string;
  role?: string;
  /** DEC-258: contact's current title/company at invite time, snapshotted
   * onto the new participant row. Caller passes these from the contact
   * record it already fetched to validate org ownership — this function
   * performs no additional contact lookup of its own. */
  titleAtTime?: string | null;
  orgAtTime?: string | null;
  /** Contact's name/email, from the same caller-side contact lookup used
   * for titleAtTime/orgAtTime — passed through so the returned row is
   * complete without a second query (DEC-265). */
  firstName: string;
  lastName: string;
  email: string;
}

/** Participant row shape shared by both endpoints' responses, matching
 * src/server/repo/submissions/detail.ts's SubmissionDetailParticipant
 * field-for-field (DEC-265), so a freshly invited/patched participant
 * round-trips identically to a page reload. */
export interface ParticipantRow {
  id: string;
  contactId: string;
  name: string;
  email: string;
  title: string | null;
  company: string | null;
  role: string;
  order: number;
  visible: boolean;
  inviteStatus: string;
}

/** Inserts a new participant row: visible=true, inviteStatus='invited',
 * order=max(order)+1 for the submission, role defaults to 'speaker'.
 * Returns DUPLICATE_PARTICIPANT (without writing) if a participant already
 * exists for this (submissionId, contactId) pair, and OVER_CAP (without
 * writing) if the submission is already at MAX_PARTICIPANTS_PER_SUBMISSION
 * — this count is read BEFORE the insert is attempted, not derived from a
 * failed write, so the organizer door enforces the same submission-level
 * cap addCoPresenter does. Caller is expected to have already verified the
 * submission and contact both belong to the caller's org. */
export async function inviteParticipant(
  db: Db,
  input: InviteParticipantInput,
): Promise<ParticipantRow | typeof DUPLICATE_PARTICIPANT | typeof OVER_CAP> {
  const { submissionId, contactId } = input;
  const role = input.role && input.role.trim() ? input.role : DEFAULT_PARTICIPANT_ROLE;

  const count = await getParticipantCount(db, submissionId);
  if (count >= MAX_PARTICIPANTS_PER_SUBMISSION) return OVER_CAP;

  const now = new Date();
  const id = newId();
  const nextOrderSql = sql<number>`(SELECT COALESCE(MAX(${schema.participant.order}), -1) + 1 FROM ${schema.participant} WHERE ${schema.participant.submissionId} = ${submissionId})`;
  const inserted = await db
    .insert(schema.participant)
    .values({
      id,
      submissionId,
      contactId,
      role,
      order: nextOrderSql,
      visible: true,
      inviteStatus: "invited",
      titleAtTime: input.titleAtTime ?? null,
      orgAtTime: input.orgAtTime ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.participant.submissionId, schema.participant.contactId] })
    .returning({ id: schema.participant.id, order: schema.participant.order });
  const row = inserted[0];
  if (!row) return DUPLICATE_PARTICIPANT;

  // DEC-725 amendment: this insert changes the submission's published
  // Speakers cell composition — see submissions/touch.ts header.
  await touchSubmissions(db, [submissionId], now);

  return {
    id: row.id,
    contactId,
    name: `${input.firstName} ${input.lastName}`.trim(),
    email: input.email,
    // DEC-265: title/company mirror the contact's CURRENT title/company,
    // the same fields getSubmissionDetail's participant join reads --
    // titleAtTime/orgAtTime is a separate historical snapshot, not this
    // display value, but at invite time the two are the same value.
    title: input.titleAtTime ?? null,
    company: input.orgAtTime ?? null,
    role,
    order: row.order,
    visible: true,
    inviteStatus: "invited",
  };
}

/** Set-based active-participant attach (DEC-810 amendment, wave 59): used by
 * pushContactsToEvent to attach every contact in a batch roster import to
 * ONE submission as ACTIVE participants (inviteStatus='none', not
 * 'invited' -- an imported roster member must be active from the start so
 * DEC-283/DEC-746's onboarding-task expansion picks them up and they can
 * reach public surfaces once the submission is content-approved; the
 * 'invited' status inviteParticipant above uses is for a co-presenter who
 * still needs to accept, which is the wrong state for someone the organizer
 * just imported directly onto an already-accepted session). One chunked
 * INSERT (chunkRowsForInsert, DEC-542), not a per-row loop. `order` is the
 * caller-supplied input index (0 for the lead contact already inserted by
 * createSubmission, so this is called with the REMAINING contacts starting
 * at order 1).
 *
 * DEC-604 amendment (findings wave 15, task-w15-b): reads the submission's
 * current participant count and throws ApiError('invalid', ...) BEFORE any
 * write if `existing + contacts.length` would exceed
 * MAX_PARTICIPANTS_PER_SUBMISSION -- this is the batch-roster-import
 * counterpart to inviteParticipant's OVER_CAP check above and
 * portal-edit.ts's addCoPresenter check, so a 200-row roster CSV can no
 * longer land 199 participants on one submission against a cap of 6. Callers
 * (routes/api/contacts/import.ts) also pre-check the same cap before any
 * write is attempted, so a route-level refusal fires first in the normal
 * request path; this assertion is the repo-level backstop that makes the cap
 * a property of insertActiveParticipants itself, not just of its one
 * caller's pre-check. */
export async function insertActiveParticipants(
  db: Db,
  submissionId: string,
  contacts: {
    contactId: string;
    role: string;
    order: number;
    titleAtTime: string | null;
    orgAtTime: string | null;
  }[],
): Promise<void> {
  if (contacts.length === 0) return;
  const existingCount = await getParticipantCount(db, submissionId);
  if (existingCount + contacts.length > MAX_PARTICIPANTS_PER_SUBMISSION) {
    throw new ApiError("invalid", participantCapRefusalMessage(existingCount, MAX_PARTICIPANTS_PER_SUBMISSION), {
      submissionId: participantCapRefusalMessage(existingCount, MAX_PARTICIPANTS_PER_SUBMISSION),
    });
  }
  const now = new Date();
  const rows = contacts.map((c) => ({
    id: newId(),
    submissionId,
    contactId: c.contactId,
    role: c.role,
    order: c.order,
    visible: true,
    inviteStatus: "none" as const,
    titleAtTime: c.titleAtTime,
    orgAtTime: c.orgAtTime,
    createdAt: now,
    updatedAt: now,
  }));
  for (const chunk of chunkRowsForInsert(rows)) {
    await db.insert(schema.participant).values(chunk);
  }
  // DEC-725 amendment: unlike the invite/visibility/status writers below,
  // this function's one caller (pushContactsToEvent, src/server/repo/
  // contacts/push.ts) always calls it in the same request that just
  // createSubmission'd submissionId — that INSERT already stamped
  // updatedAt to `now` moments earlier, so there is no stale stamp to
  // correct here. No touchSubmissions call (see submissions/touch.ts
  // header for the general contract this deliberately doesn't need).
}

export interface ParticipantScope {
  id: string;
  submissionId: string;
  orgId: string;
}

/** Ownership lookup for a single participant row, scoped through its
 * submission -> event -> org — used before any visibility-toggle write. */
export async function getParticipantOwnership(db: Db, participantId: string): Promise<ParticipantScope | null> {
  const rows = await db
    .select({
      id: schema.participant.id,
      submissionId: schema.participant.submissionId,
      orgId: schema.event.orgId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

/** `submissionId` is the participant's owning submission (the caller has
 * already resolved this via getParticipantOwnership for its own scope
 * check) — passed in rather than re-derived here (e.g. via `.returning()`)
 * so this stays one write, not a write-plus-readback. DEC-725 amendment: a
 * visibility toggle changes which speakers a submission publishes, so the
 * owning submission's updatedAt is bumped alongside the participant row's —
 * see submissions/touch.ts header. */
export async function setParticipantVisible(
  db: Db,
  participantId: string,
  visible: boolean,
  submissionId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(schema.participant)
    .set({ visible, updatedAt: now })
    .where(eq(schema.participant.id, participantId));
  await touchSubmissions(db, [submissionId], now);
}

/** DEC-789 write half: organizer-only invite-status write, validated by the
 * caller against the closed none|invited|accepted|declined set before this
 * function is reached. Bumps updatedAt like every other participant write
 * in this module, and — DEC-725 amendment — also bumps the owning
 * submission's updatedAt (passed in, same reasoning as setParticipantVisible
 * above), since an invite-status change (most notably a decline, DEC-981)
 * changes the submission's published Speakers cell. */
export async function setParticipantInviteStatus(
  db: Db,
  participantId: string,
  inviteStatus: string,
  submissionId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(schema.participant)
    .set({ inviteStatus, updatedAt: now })
    .where(eq(schema.participant.id, participantId));
  await touchSubmissions(db, [submissionId], now);
}

/** DEC-805 write half: the portal-invite SEND is the door that mints
 * inviteStatus='invited'.
 *
 * DEC-869 (ParticipationMenu) deliberately dropped 'invited' from the three
 * states an organizer can PICK -- "Send portal invite" occupies that slot as
 * an ACTION whose caption promises "Emails a claim link and sets this to
 * Invited". Nothing was writing that status, so the send left every
 * participation at 'Not invited' and the promise was false after a reload.
 * This is the missing write.
 *
 * Scope: every participation the contact holds on a submission in THIS event
 * (the claim link a portal invite mints is event-scoped, so it covers all of
 * them) that is still at 'none'. A participation already carrying the
 * speaker's OWN answer -- 'accepted' or 'declined' -- is never walked
 * backwards by re-sending a claim link, and one already at 'invited' needs
 * no write. Callers pass only the contacts whose send actually SUCCEEDED, so
 * a failed send never claims an invitation went out.
 *
 * Bumps the owning submissions' updatedAt through touchSubmissions for the
 * same DEC-725 reason setParticipantInviteStatus does. */
export async function markParticipantsInvited(db: Db, eventId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  const now = new Date();
  const targets: { id: string; submissionId: string }[] = [];
  for (const batch of chunkIds(contactIds)) {
    const rows = await db
      .select({ id: schema.participant.id, submissionId: schema.participant.submissionId })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .where(
        and(
          eq(schema.submission.eventId, eventId),
          inArray(schema.participant.contactId, batch),
          eq(schema.participant.inviteStatus, "none"),
        ),
      );
    targets.push(...rows);
  }
  if (targets.length === 0) return;
  for (const batch of chunkIds(targets.map((t) => t.id))) {
    await db
      .update(schema.participant)
      .set({ inviteStatus: "invited", updatedAt: now })
      .where(inArray(schema.participant.id, batch));
  }
  await touchSubmissions(db, [...new Set(targets.map((t) => t.submissionId))], now);
}

/** DEC-900 amendment (findings wave 13): resolves the submission's LEAD
 * participant id — the same rule the SPA's speaker rail already applies
 * (app/src/pages/submissions/SubmissionDetailPage.tsx:917): the participant
 * with role==='speaker', falling back to the first participant by order asc
 * (contactId asc as the tie-break, matching getSubmissionDetail's ordering)
 * when no row carries that role. Null when the submission has no
 * participants at all. Used by the role-PATCH route below to refuse
 * retargeting the lead. */
export async function getSubmissionLeadParticipantId(db: Db, submissionId: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.participant.id, role: schema.participant.role })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId))
    .orderBy(asc(schema.participant.order), asc(schema.participant.contactId));
  const first = rows[0];
  if (!first) return null;
  const speaker = rows.find((r) => r.role === "speaker");
  return speaker ? speaker.id : first.id;
}

/** DEC-900 amendment (findings wave 13): organizer-only participant-role
 * write ("Make co-presenter" and any future role-change control), validated
 * by the caller against PARTICIPANT_ROLE_OPTIONS (and the lead-protection
 * rule) before this function is reached. Same shape as
 * setParticipantVisible/setParticipantInviteStatus above: bumps the
 * participant row's updatedAt AND the owning submission's updatedAt, since a
 * role change can change the submission's published Speakers cell. */
export async function setParticipantRole(
  db: Db,
  participantId: string,
  role: string,
  submissionId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(schema.participant)
    .set({ role, updatedAt: now })
    .where(eq(schema.participant.id, participantId));
  await touchSubmissions(db, [submissionId], now);
}

/** Current participant-row count for a submission, exposed so a caller that
 * receives OVER_CAP from inviteParticipant can compose an accurate refusal
 * message (src/domain/cap-copy.ts:participantCapRefusalMessage) without
 * inviteParticipant itself having to smuggle a count through its sentinel
 * return value. */
export async function getParticipantCount(db: Db, submissionId: string): Promise<number> {
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));
  return countRows[0]?.count ?? 0;
}

/** Fetches a single participant row in the same shape inviteParticipant
 * returns, for endpoints (like the PATCH visibility toggle) that mutate a
 * participant and then need to serialize the current state. */
export async function getParticipantRow(db: Db, participantId: string): Promise<ParticipantRow | null> {
  const rows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      title: schema.contact.title,
      company: schema.contact.company,
      role: schema.participant.role,
      order: schema.participant.order,
      visible: schema.participant.visible,
      inviteStatus: schema.participant.inviteStatus,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contactId,
    name: `${row.firstName} ${row.lastName}`.trim(),
    email: row.email,
    title: row.title,
    company: row.company,
    role: row.role,
    order: row.order,
    visible: row.visible,
    inviteStatus: row.inviteStatus,
  };
}

/** Removes a participant row outright, scoped to its submission (user-filed,
 * gate-8 cycle: the detail page's Remove shipped with no server half). The
 * lead-protection decision belongs to the ROUTE (same split as the role
 * retarget guard above) — this is the bare scoped delete. Returns the
 * number of rows removed (0 when the scope missed). */
export async function removeParticipantRow(
  db: Db,
  participantId: string,
  submissionId: string,
): Promise<number> {
  const result = await db
    .delete(schema.participant)
    .where(and(eq(schema.participant.id, participantId), eq(schema.participant.submissionId, submissionId)));
  return result.meta?.changes ?? 0;
}
