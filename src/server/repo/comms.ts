// J5 compose repo layer (DEC-012/DEC-019): email_template CRUD plus the
// data-loading needed to expand submissions -> participants -> feedback for
// the compose pipeline. Only this file (and repo/email.ts) touches drizzle
// row types for comms; src/domain/compose.ts stays pure.

import { and, asc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { ComposeSubmission } from "../../domain/compose";
export type { ComposeSubmission } from "../../domain/compose";
import { chunkIds, ID_CHUNK_SIZE } from "../../lib/chunk";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { slotWithinEventRange } from "./public/gates";
import { dedupeKey } from "../../domain/comms-dedupe";
import { submittedEvaluationCondition } from "./review/evaluations";
import { DEC_271 } from "../../decisions";
void DEC_271;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface EmailTemplateRow {
  id: string;
  eventId: string;
  name: string;
  subject: string;
  bodyText: string;
  createdAt: number;
  updatedAt: number;
}

function toTemplateRow(row: typeof schema.emailTemplate.$inferSelect): EmailTemplateRow {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    subject: row.subject,
    bodyText: row.bodyText,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** DEC-461: optional trailing page param — absent means today's unbounded
 * behavior (internal callers unchanged). `id asc` is a deterministic
 * tiebreak after name for stable pagination across pages. */
export async function listTemplates(
  db: Db,
  eventId: string,
  page?: { limit: number; offset: number },
): Promise<EmailTemplateRow[]> {
  const base = db
    .select()
    .from(schema.emailTemplate)
    .where(eq(schema.emailTemplate.eventId, eventId))
    .orderBy(asc(schema.emailTemplate.name), asc(schema.emailTemplate.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toTemplateRow);
}

/** DEC-461 sibling count fn for the true `total` alongside a bounded
 * listTemplates page. */
export async function countTemplates(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.emailTemplate)
    .where(eq(schema.emailTemplate.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
}

export async function findTemplateById(db: Db, id: string): Promise<EmailTemplateRow | null> {
  const rows = await db.select().from(schema.emailTemplate).where(eq(schema.emailTemplate.id, id)).limit(1);
  const row = rows[0];
  return row ? toTemplateRow(row) : null;
}

/** Ownership check: does this template belong to the given org (via its event)? */
export async function findTemplateForOrg(db: Db, id: string, orgId: string): Promise<EmailTemplateRow | null> {
  const template = await findTemplateById(db, id);
  if (!template) return null;
  const eventRows = await db
    .select({ id: schema.event.id })
    .from(schema.event)
    .where(and(eq(schema.event.id, template.eventId), eq(schema.event.orgId, orgId)))
    .limit(1);
  return eventRows[0] ? template : null;
}

export interface TemplateInput {
  name: string;
  subject: string;
  bodyText: string;
}

export async function createTemplate(db: Db, eventId: string, input: TemplateInput): Promise<EmailTemplateRow> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.emailTemplate).values({
    id,
    eventId,
    name: input.name,
    subject: input.subject,
    bodyText: input.bodyText,
    createdAt: now,
    updatedAt: now,
  });
  const created = await findTemplateById(db, id);
  if (!created) throw new Error("template insert did not persist");
  return created;
}

export interface TemplatePatch {
  name?: string;
  subject?: string;
  bodyText?: string;
}

export async function patchTemplate(db: Db, id: string, patch: TemplatePatch): Promise<EmailTemplateRow> {
  await db
    .update(schema.emailTemplate)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.bodyText !== undefined ? { bodyText: patch.bodyText } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.emailTemplate.id, id));
  const updated = await findTemplateById(db, id);
  if (!updated) throw new Error(`template ${id} not found after update`);
  return updated;
}

export async function deleteTemplate(db: Db, id: string): Promise<void> {
  await db.delete(schema.emailTemplate).where(eq(schema.emailTemplate.id, id));
}

// ---------------------------------------------------------------------------
// Portal invites (DEC-805)
// ---------------------------------------------------------------------------

export interface ParticipantContactRow {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** DEC-805 preflight lookup: every distinct contact, among the given
 * contactIds, that IS a `participant` on some submission in this event (any
 * inviteStatus — unlike loadComposeSubmissions this is a membership check,
 * not a "who should be emailed a compose" filter). The route diffs the
 * requested contactIds against this result's ids and rejects the whole call
 * naming any that don't come back, rather than silently inviting a smaller
 * set. Chunked (DEC-078) since contactIds can be as large as
 * MAX_PORTAL_INVITE_RECIPIENTS. */
export async function findParticipantContactsForEvent(
  db: Db,
  eventId: string,
  contactIds: string[],
): Promise<ParticipantContactRow[]> {
  if (contactIds.length === 0) return [];
  const seen = new Set<string>();
  const rows: ParticipantContactRow[] = [];
  for (const batch of chunkIds(contactIds)) {
    const batchRows = await db
      .selectDistinct({
        contactId: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.participant.contactId, batch)));
    for (const row of batchRows) {
      if (seen.has(row.contactId)) continue;
      seen.add(row.contactId);
      rows.push(row);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Compose data loading: submissions -> participants (+ feedback)
// ---------------------------------------------------------------------------

// D1 rejects a single statement once its total bound-parameter count passes
// a low ceiling (empirically ~100 in local dev) — well under the DEC-019
// 100-recipient compose cap's own submissionIds input (a producer can select
// up to MAX_PER_PAGE=200 submissions before the cap check on the *expanded*
// recipient list even runs), so any inArray(...) keyed off the full
// submissionIds list must be batched via the canonical chunkIds (DEC-078).

/** Loads the given submissions (scoped to eventId) with their ACTIVE-invite
 * participants (DEC-317: inviteStatus in ACTIVE_INVITE_STATUSES — 'none' or
 * 'accepted' — never 'invited' or 'declined'), for src/domain/compose.ts's
 * expandRecipients. This filter deliberately ignores participant.visible:
 * visible governs program/public display, not who is eligible to receive
 * organizer mail, so a visible=0 accepted co-speaker still gets composed to.
 * Submission ids not belonging to this event are silently excluded (not a
 * 404 — the caller validates the full set matched before proceeding). */
export async function loadComposeSubmissions(
  db: Db,
  eventId: string,
  submissionIds: string[],
): Promise<ComposeSubmission[]> {
  if (submissionIds.length === 0) return [];

  const submissionRows: { id: string; title: string; seq: number }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({ id: schema.submission.id, title: schema.submission.title, seq: schema.submission.seq })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, batch)));
    submissionRows.push(...batchRows);
  }

  if (submissionRows.length === 0) return [];

  // DEC-078 chunking means SQL order can't survive across batches, so the
  // canonical order is re-established here in JS: submissions by seq asc,
  // then each submission's participants by (order asc, contactId asc) — the
  // DEC-562 people order the notify pipeline must reproduce across requests.
  submissionRows.sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));

  const foundIds = submissionRows.map((r) => r.id);
  const participantRows: {
    submissionId: string;
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
    order: number;
  }[] = [];
  for (const batch of chunkIds(foundIds)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        contactId: schema.participant.contactId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
        order: schema.participant.order,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(
        and(
          inArray(schema.participant.submissionId, batch),
          inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
        ),
      );
    participantRows.push(...batchRows);
  }
  participantRows.sort((a, b) => a.order - b.order || a.contactId.localeCompare(b.contactId));

  return submissionRows.map((s) => ({
    id: s.id,
    title: s.title,
    seq: s.seq,
    participants: participantRows
      .filter((p) => p.submissionId === s.id)
      .map((p) => ({ contactId: p.contactId, firstName: p.firstName, lastName: p.lastName, email: p.email })),
  }));
}

/** DEC-530/DEC-682: batched loader — one chunked query pass for an
 * arbitrary set of submissions instead of one query per submission (compose
 * preview/send re-queries the SAME submission once per co-speaker
 * otherwise). Scoped to exactly the composing plan's round (DEC-682: a
 * decision mailer must never leak another plan's or an earlier/later
 * round's comments alongside the composing round's) — same filter
 * (submittedAt not null, non-blank comment) and the same asc(createdAt),
 * asc(id) ordering per submission; a submission with zero qualifying
 * comments in that plan+round is simply absent from the returned map.
 * DEC-271 (wave-110 amendment): a recused reviewer's comment is excluded via
 * a set-based left-join-is-null anti-join against review_recusal on
 * (planId, submissionId, reviewerId) in the SAME batched query — scoring
 * then recusing is legal (src/routes/review/recusals.ts places no
 * evaluation check), so the merge must never trust submittedAt alone. */
export async function listFeedbackCommentsForSubmissions(
  db: Db,
  submissionIds: string[],
  scope: { planId: string; round: number },
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (submissionIds.length === 0) return map;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.evaluation.submissionId,
        comment: schema.evaluation.comment,
        submittedAt: schema.evaluation.submittedAt,
      })
      .from(schema.evaluation)
      .leftJoin(
        schema.reviewRecusal,
        and(
          eq(schema.reviewRecusal.planId, schema.evaluation.planId),
          eq(schema.reviewRecusal.submissionId, schema.evaluation.submissionId),
          eq(schema.reviewRecusal.userId, schema.evaluation.reviewerId),
        ),
      )
      .where(
        and(
          inArray(schema.evaluation.submissionId, batch),
          eq(schema.evaluation.planId, scope.planId),
          eq(schema.evaluation.round, scope.round),
          submittedEvaluationCondition(),
          isNull(schema.reviewRecusal.id),
        ),
      )
      .orderBy(asc(schema.evaluation.createdAt), asc(schema.evaluation.id));
    for (const row of rows) {
      if (!row.comment || row.comment.trim() === "") continue;
      const existing = map.get(row.submissionId);
      if (existing) existing.push(row.comment);
      else map.set(row.submissionId, [row.comment]);
    }
  }
  return map;
}

/** DEC-456 (wave-71 amendment): account identity is answered by contact_id
 * OR email, never email alone — a contact's email can drift out of sync
 * with its linked user row (e.g. mid-edit, or deliberately after a merge
 * repoint), so a hit on either key means "this contact already has an
 * account". The resolved priority is contact_id first, then lowercased
 * email, deterministic even when both keys hit different rows: this
 * function delegates to the batched findAccountUserIds (one array of one)
 * so the priority has exactly ONE implementation and cannot drift between
 * the single-row and batch paths. The portal_link merge var is /portal for
 * existing users, else a fresh DEC-014 claim link (route layer mints the
 * token). */
export async function findAccountUserId(db: Db, params: { contactId: string; email: string }): Promise<string | null> {
  const result = await findAccountUserIds(db, [params]);
  return result.get(params.contactId) ?? null;
}

// Each row of this lookup binds TWO columns (contact_id, lower(email)), so
// its batch size is derived from chunkIds' single-column ID_CHUNK_SIZE
// halved (DEC-528: derive columns-per-row from the rows, never hand-declare
// a fresh magic number) rather than reusing chunkIds directly.
const ACCOUNT_LOOKUP_COLUMNS_PER_ROW = 2;
const ACCOUNT_LOOKUP_BATCH_SIZE = Math.floor(ID_CHUNK_SIZE / ACCOUNT_LOOKUP_COLUMNS_PER_ROW);

/** DEC-530 batched query, chunked one query pass per ACCOUNT_LOOKUP_BATCH_SIZE
 * recipients instead of one query per recipient; findAccountUserId (the
 * single-row case) delegates here so there is exactly one implementation of
 * the DEC-456 priority. Keyed by contactId in the returned map; every
 * requested contactId is present (null when neither key hit). Resolved
 * priority, a PROPERTY of this function (not an aspiration): a hit by
 * contact_id always wins over a hit by lowercased email, even when the two
 * keys point at different user rows — the underlying select is ordered by
 * user.id (asc) so that when two rows tie on the SAME key (two users
 * sharing a contact_id, or two sharing a lowercased email — both should be
 * impossible under user_email_idx / contact_id uniqueness, but the map
 * build is last-write-wins), the winner is deterministic rather than
 * whatever order SQLite happens to return rows in. */
export async function findAccountUserIds(db: Db, params: { contactId: string; email: string }[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const p of params) result.set(p.contactId, null);
  if (params.length === 0) return result;

  const rows: { id: string; contactId: string | null; email: string }[] = [];
  for (let i = 0; i < params.length; i += ACCOUNT_LOOKUP_BATCH_SIZE) {
    const batch = params.slice(i, i + ACCOUNT_LOOKUP_BATCH_SIZE);
    const contactIds = [...new Set(batch.map((p) => p.contactId))];
    const emails = [...new Set(batch.map((p) => p.email.toLowerCase()))];
    const batchRows = await db
      .select({ id: schema.user.id, contactId: schema.user.contactId, email: schema.user.email })
      .from(schema.user)
      .where(or(inArray(schema.user.contactId, contactIds), inArray(sql`lower(${schema.user.email})`, emails)))
      .orderBy(asc(schema.user.id));
    rows.push(...batchRows);
  }

  // rows are ordered by user.id (asc) above, so when two rows tie on the
  // same key this last-write-wins build is deterministic, not arbitrary.
  const byContactId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const row of rows) {
    if (row.contactId) byContactId.set(row.contactId, row.id);
    byEmail.set(row.email.toLowerCase(), row.id);
  }
  for (const p of params) {
    const hit = byContactId.get(p.contactId) ?? byEmail.get(p.email.toLowerCase()) ?? null;
    result.set(p.contactId, hit);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Calendar invites (DEC-051): schedule slot + room + ics_sequence, one query
// pass per selected submission set.
// ---------------------------------------------------------------------------

export interface IcsScheduleRow {
  submissionId: string;
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
  icsSequence: number;
}

/** Loads schedule slot (day/start/end), room name, and the current
 * ics_sequence for each of the given submission ids, in one query pass.
 * Submissions with no schedule_slot row, OR whose slot day falls outside
 * `event`'s [startDate, endDate] range (DEC-318), are simply absent from the
 * returned map — the caller (route layer) treats a missing entry as
 * "unscheduled" and rejects attachIcs before any send (DEC-051/DEC-019).
 * The DEC-318 bound is applied in SQL via slotWithinEventRange (the same
 * predicate the public agenda/schedule reads use, per DEC-312) so this map,
 * the DEC-912 `scheduled` flag, and the ICS preflight all agree with the
 * admin agenda's unscheduled bucket by construction. */
export async function loadIcsScheduleData(
  db: Db,
  event: { startDate: string; endDate: string },
  submissionIds: string[],
): Promise<Map<string, IcsScheduleRow>> {
  if (submissionIds.length === 0) return new Map();

  const rows: {
    submissionId: string;
    day: string;
    startMin: number;
    endMin: number;
    roomId: string | null;
    icsSequence: number;
  }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomId: schema.scheduleSlot.roomId,
        icsSequence: schema.submission.icsSequence,
      })
      .from(schema.scheduleSlot)
      .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
      .where(and(inArray(schema.scheduleSlot.submissionId, batch), slotWithinEventRange(event)));
    rows.push(...batchRows);
  }

  // roomIds is bounded by the event's physical room count (~15) — a
  // DEC-078 bounded-list exemption, so this inArray stays unchunked.
  const roomIds = [...new Set(rows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db.select({ id: schema.room.id, name: schema.room.name }).from(schema.room).where(inArray(schema.room.id, roomIds));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  const map = new Map<string, IcsScheduleRow>();
  for (const row of rows) {
    map.set(row.submissionId, {
      submissionId: row.submissionId,
      day: row.day,
      startMin: row.startMin,
      endMin: row.endMin,
      roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
      icsSequence: row.icsSequence,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Compose dedupe (DEC-238 wave-3 amendment)
// ---------------------------------------------------------------------------

/** For each (email, subject) pair, the most recent `sent_at` (ms) among this
 * event's `email_log` rows with status 'sent' whose sent_at is at or after
 * `cutoffMs` — keyed by src/domain/comms-dedupe.ts's dedupeKey so the route
 * layer's skip decision and this reader always agree on message identity.
 * A pair with no qualifying row is simply absent from the returned map.
 * Chunks the email inArray() through chunkIds (DEC-078) — the incoming
 * `keys` list is bounded by MAX_COMPOSE_RECIPIENTS, but this reader must not
 * itself assume any particular caller's cap. */
export async function loadRecentlySent(
  db: Db,
  eventId: string,
  keys: { email: string; subject: string }[],
  cutoffMs: number,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (keys.length === 0) return result;

  const wantedKeys = new Set(keys.map((k) => dedupeKey(k.email, k.subject)));
  const emails = [...new Set(keys.map((k) => k.email.trim().toLowerCase()))];

  const rows: { toEmail: string; subject: string; sentAt: Date }[] = [];
  for (const emailChunk of chunkIds(emails)) {
    const batchRows = await db
      .select({
        toEmail: schema.emailLog.toEmail,
        subject: schema.emailLog.subject,
        sentAt: schema.emailLog.sentAt,
      })
      .from(schema.emailLog)
      .where(
        and(
          eq(schema.emailLog.eventId, eventId),
          eq(schema.emailLog.status, "sent"),
          gte(schema.emailLog.sentAt, new Date(cutoffMs)),
          inArray(sql`lower(${schema.emailLog.toEmail})`, emailChunk),
        ),
      );
    rows.push(...batchRows);
  }

  for (const row of rows) {
    const key = dedupeKey(row.toEmail, row.subject);
    if (!wantedKeys.has(key)) continue;
    const sentAtMs = row.sentAt.getTime();
    const existing = result.get(key);
    if (existing === undefined || sentAtMs > existing) result.set(key, sentAtMs);
  }
  return result;
}

