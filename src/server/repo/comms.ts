// J5 compose repo layer (DEC-012/DEC-019): email_template CRUD plus the
// data-loading needed to expand submissions -> participants -> feedback for
// the compose pipeline. Only this file (and repo/email.ts) touches drizzle
// row types for comms; src/domain/compose.ts stays pure.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { ComposeSubmission } from "../../domain/compose";
import { chunkIds } from "../../lib/chunk";

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

export async function listTemplates(db: Db, eventId: string): Promise<EmailTemplateRow[]> {
  const rows = await db
    .select()
    .from(schema.emailTemplate)
    .where(eq(schema.emailTemplate.eventId, eventId))
    .orderBy(asc(schema.emailTemplate.name));
  return rows.map(toTemplateRow);
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

/** Loads the given submissions (scoped to eventId) with their visible
 * participants, for src/domain/compose.ts's expandRecipients. Submission ids
 * not belonging to this event are silently excluded (not a 404 — the caller
 * validates the full set matched before proceeding). */
export async function loadComposeSubmissions(
  db: Db,
  eventId: string,
  submissionIds: string[],
): Promise<ComposeSubmission[]> {
  if (submissionIds.length === 0) return [];

  const submissionRows: { id: string; title: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({ id: schema.submission.id, title: schema.submission.title })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, batch)));
    submissionRows.push(...batchRows);
  }

  if (submissionRows.length === 0) return [];

  const foundIds = submissionRows.map((r) => r.id);
  const participantRows: {
    submissionId: string;
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
  }[] = [];
  for (const batch of chunkIds(foundIds)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        contactId: schema.participant.contactId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...batchRows);
  }

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
    .orderBy(asc(schema.evaluation.createdAt));
  return rows.filter((r) => r.submittedAt !== null && r.comment && r.comment.trim() !== "").map((r) => r.comment as string);
}

/** True when a user row exists for this contact email (case-insensitive) —
 * the portal_link merge var is /portal for existing users, else a fresh
 * DEC-014 claim link (route layer mints the token). */
export async function findUserIdByEmail(db: Db, email: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = lower(${email})`)
    .limit(1);
  return rows[0]?.id ?? null;
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

/** Bumps submission.ics_sequence by exactly 1 for each given submission id
 * (DEC-051: once per submission per send call — never on preview, and never
 * more than once even when a submission has multiple recipients). */
export async function bumpIcsSequences(db: Db, submissionIds: string[]): Promise<void> {
  const unique = [...new Set(submissionIds)];
  for (const id of unique) {
    await db
      .update(schema.submission)
      .set({ icsSequence: sql`${schema.submission.icsSequence} + 1` })
      .where(eq(schema.submission.id, id));
  }
}
