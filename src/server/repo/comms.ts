// J5 compose repo layer (DEC-012/DEC-019): email_template CRUD plus the
// data-loading needed to expand submissions -> participants -> feedback for
// the compose pipeline. Only this file (and repo/email.ts) touches drizzle
// row types for comms; src/domain/compose.ts stays pure.

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { ComposeSubmission } from "../../domain/compose";
export type { ComposeSubmission } from "../../domain/compose";
import { chunkIds, ID_CHUNK_SIZE } from "../../lib/chunk";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";

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
    participants: participantRows
      .filter((p) => p.submissionId === s.id)
      .map((p) => ({ contactId: p.contactId, firstName: p.firstName, lastName: p.lastName, email: p.email })),
  }));
}

/** Non-empty evaluation comments for a submission, oldest-first, for
 * formatFeedback's 'Reviewer N' anonymized ordering. */
export async function listFeedbackComments(db: Db, submissionId: string): Promise<string[]> {
  const rows = await db
    .select({ comment: schema.evaluation.comment, submittedAt: schema.evaluation.submittedAt })
    .from(schema.evaluation)
    .where(eq(schema.evaluation.submissionId, submissionId))
    .orderBy(asc(schema.evaluation.createdAt), asc(schema.evaluation.id));
  return rows.filter((r) => r.submittedAt !== null && r.comment && r.comment.trim() !== "").map((r) => r.comment as string);
}

/** DEC-530: batched sibling of listFeedbackComments — one chunked query
 * pass for an arbitrary set of submissions instead of one query per
 * submission (compose preview/send re-queries the SAME submission once per
 * co-speaker otherwise). Same filter (submittedAt not null, non-blank
 * comment) and the same asc(createdAt) ordering per submission; a
 * submission with zero qualifying comments is simply absent from the
 * returned map. */
export async function listFeedbackCommentsForSubmissions(db: Db, submissionIds: string[]): Promise<Map<string, string[]>> {
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
      .where(inArray(schema.evaluation.submissionId, batch))
      .orderBy(asc(schema.evaluation.createdAt), asc(schema.evaluation.id));
    for (const row of rows) {
      if (row.submittedAt === null || !row.comment || row.comment.trim() === "") continue;
      const existing = map.get(row.submissionId);
      if (existing) existing.push(row.comment);
      else map.set(row.submissionId, [row.comment]);
    }
  }
  return map;
}

/** DEC-456: account identity is answered by contact_id OR email, never
 * email alone — a contact's email can drift out of sync with its linked
 * user row (e.g. mid-edit, or deliberately after a merge repoint), so a
 * hit on either key means "this contact already has an account". The
 * portal_link merge var is /portal for existing users, else a fresh
 * DEC-014 claim link (route layer mints the token). */
export async function findAccountUserId(db: Db, params: { contactId: string; email: string }): Promise<string | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(or(eq(schema.user.contactId, params.contactId), sql`lower(${schema.user.email}) = lower(${params.email})`))
    .limit(1);
  return rows[0]?.id ?? null;
}

// Each row of this lookup binds TWO columns (contact_id, lower(email)), so
// its batch size is derived from chunkIds' single-column ID_CHUNK_SIZE
// halved (DEC-528: derive columns-per-row from the rows, never hand-declare
// a fresh magic number) rather than reusing chunkIds directly.
const ACCOUNT_LOOKUP_COLUMNS_PER_ROW = 2;
const ACCOUNT_LOOKUP_BATCH_SIZE = Math.floor(ID_CHUNK_SIZE / ACCOUNT_LOOKUP_COLUMNS_PER_ROW);

/** DEC-530 batched sibling of findAccountUserId, expressing the SAME
 * predicate (DEC-456: contact_id OR lower(email), never email alone) in one
 * chunked query pass instead of one query per recipient. Keyed by
 * contactId in the returned map; every requested contactId is present
 * (null when neither key hit). Associates hits back by contactId first,
 * then by lowercased email, so a batch can never quietly narrow to
 * email-only — that would mint claim links for contacts who already have
 * logins. */
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
      .where(or(inArray(schema.user.contactId, contactIds), inArray(sql`lower(${schema.user.email})`, emails)));
    rows.push(...batchRows);
  }

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
 * Submissions with no schedule_slot row are simply absent from the returned
 * map — the caller (route layer) treats a missing entry as "unscheduled"
 * and rejects attachIcs before any send (DEC-051/DEC-019). */
export async function loadIcsScheduleData(db: Db, submissionIds: string[]): Promise<Map<string, IcsScheduleRow>> {
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
      .where(inArray(schema.scheduleSlot.submissionId, batch));
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

