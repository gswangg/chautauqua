// CRM repo layer (J11, DEC-026). Only this module touches drizzle row types
// for contacts/segments (DEC-012); handlers in src/routes/api/contacts.ts
// call these, which call the already-landed pure core src/domain/contacts.ts
// (findDuplicateGroups, planMerge, matchesSegment, mapImportRow). The
// non-db-dependent decisions below (sort comparator, import upsert
// resolution, merge repoint plan) are factored out as plain functions so
// they're directly vitest-testable without a D1 binding (no D1 test harness
// exists in this repo — see test/contacts-repo.test.ts).

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId, formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import {
  findDuplicateGroups,
  matchesSegment,
  planMerge,
  type ContactRecord,
  type SegmentRule,
} from "../../domain/contacts";

// ---------------------------------------------------------------------------
// Row shapes + mapping
// ---------------------------------------------------------------------------

export interface ContactRow {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  headshotUrl: string | null;
  socialLinksJson: string | null;
  notes: string | null;
  customFieldsJson: string | null;
  createdAt: number;
  updatedAt: number;
}

function toRow(r: typeof schema.contact.$inferSelect): ContactRow {
  return {
    id: r.id,
    orgId: r.orgId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    company: r.company,
    title: r.title,
    bio: r.bio,
    headshotUrl: r.headshotUrl,
    socialLinksJson: r.socialLinksJson,
    notes: r.notes,
    customFieldsJson: r.customFieldsJson,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  };
}

/** Projects a DB row into the pure-core ContactRecord shape (custom fields parsed). */
export function toContactRecord(row: ContactRow): ContactRecord {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    ...(row.company ? { company: row.company } : {}),
    ...(row.title ? { title: row.title } : {}),
    ...(row.customFieldsJson ? { customFields: JSON.parse(row.customFieldsJson) as Record<string, string> } : {}),
  };
}

// ---------------------------------------------------------------------------
// Pure, db-free decisions (unit-tested directly)
// ---------------------------------------------------------------------------

export interface ParsedContactListQuery {
  page: number;
  perPage: number;
  q: string | null;
  segmentId: string | null;
  sort: "name" | "recent";
  rules: SegmentRule[];
}

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

/** DEC-013 pagination parsing, DEC-026 filters (q, segmentId, sort
 * name|recent), DEC-149 multi-criteria `rules` (already-parsed+validated by
 * the route layer from ?rules= URL-encoded JSON — this function never
 * touches raw JSON, it just threads the parsed array through). */
export function parseContactListQuery(
  raw: Record<string, string | undefined>,
  rules: SegmentRule[] = [],
): ParsedContactListQuery {
  const pageNum = Number(raw.page);
  const page = Number.isFinite(pageNum) && Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

  const perPageNum = Number(raw.perPage);
  const perPage =
    Number.isFinite(perPageNum) && Number.isInteger(perPageNum) && perPageNum >= 1
      ? Math.min(perPageNum, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  const qTrimmed = raw.q?.trim();
  const q = qTrimmed ? qTrimmed : null;

  const segmentId = raw.segmentId?.trim() ? raw.segmentId.trim() : null;

  const sort = raw.sort === "recent" ? "recent" : "name";

  return { page, perPage, q, segmentId, sort, rules };
}

/** Comparator for the two DEC-026 sort orders: name (last, first) or recent (updatedAt desc). */
export function compareContacts(sort: "name" | "recent"): (a: ContactRow, b: ContactRow) => number {
  if (sort === "recent") {
    return (a, b) => b.updatedAt - a.updatedAt;
  }
  return (a, b) => {
    const last = a.lastName.localeCompare(b.lastName);
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName);
  };
}

export type ImportUpsertAction =
  | { action: "create"; values: Omit<ContactRecord, "id"> }
  | { action: "update"; id: string; patch: Partial<Omit<ContactRecord, "id">> };

/**
 * Decides create-vs-update for one already-mapped import row, matched by
 * case-insensitive email (DEC-026). `existingId` is the id of an org
 * contact whose email already matches (case-insensitively), if any. Update
 * patches only carry the fields present on the parsed row (partial CSV
 * mappings never blank out existing data).
 */
export function resolveImportUpsert(existingId: string | undefined, parsed: Partial<ContactRecord>): ImportUpsertAction {
  if (!parsed.email || parsed.email.trim() === "") {
    throw new Error("resolveImportUpsert: parsed row must have a non-blank email");
  }
  if (existingId === undefined) {
    return {
      action: "create",
      values: {
        email: parsed.email,
        firstName: parsed.firstName ?? "",
        lastName: parsed.lastName ?? "",
        ...(parsed.company !== undefined ? { company: parsed.company } : {}),
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.customFields !== undefined ? { customFields: parsed.customFields } : {}),
      },
    };
  }
  const patch: Partial<Omit<ContactRecord, "id">> = {};
  if (parsed.firstName !== undefined) patch.firstName = parsed.firstName;
  if (parsed.lastName !== undefined) patch.lastName = parsed.lastName;
  if (parsed.company !== undefined) patch.company = parsed.company;
  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.customFields !== undefined) patch.customFields = parsed.customFields;
  return { action: "update", id: existingId, patch };
}

export interface MergeRepointOp {
  table: "participant" | "task_assignment" | "email_log" | "user" | "file" | "file_comment";
  from: string;
  to: string;
}

/**
 * Plans the six FK repoints DEC-026/DEC-101 require on merge (participant,
 * task_assignment, email_log, user.contact_id, file.uploaded_by_contact_id,
 * file_comment.author_contact_id) before the duplicate row is deleted. Fails
 * loudly if asked to merge a contact into itself.
 */
export function buildMergeRepointOps(keepId: string, mergeId: string): MergeRepointOp[] {
  if (keepId === mergeId) {
    throw new Error("buildMergeRepointOps: keepId and mergeId must differ");
  }
  return (["participant", "task_assignment", "email_log", "user", "file", "file_comment"] as const).map((table) => ({
    table,
    from: mergeId,
    to: keepId,
  }));
}

// ---------------------------------------------------------------------------
// Contacts CRUD
// ---------------------------------------------------------------------------

export interface ContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  bio?: string | null;
  notes?: string | null;
  customFields?: Record<string, string> | null;
}

export interface ContactPatch {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  bio?: string | null;
  notes?: string | null;
  customFields?: Record<string, string> | null;
}

function customFieldsJsonOf(customFields: Record<string, string> | null | undefined): string | null | undefined {
  if (customFields === undefined) return undefined;
  if (customFields === null) return null;
  return JSON.stringify(customFields);
}

export async function findContactById(db: Db, id: string): Promise<ContactRow | null> {
  const rows = await db.select().from(schema.contact).where(eq(schema.contact.id, id)).limit(1);
  const row = rows[0];
  return row ? toRow(row) : null;
}

export async function findContactForOrg(db: Db, id: string, orgId: string): Promise<ContactRow | null> {
  const rows = await db
    .select()
    .from(schema.contact)
    .where(and(eq(schema.contact.id, id), eq(schema.contact.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toRow(row) : null;
}

export async function createContact(db: Db, orgId: string, input: ContactInput): Promise<ContactRow> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.contact).values({
    id,
    orgId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? null,
    company: input.company ?? null,
    title: input.title ?? null,
    bio: input.bio ?? null,
    notes: input.notes ?? null,
    customFieldsJson: customFieldsJsonOf(input.customFields) ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await findContactById(db, id);
  if (!created) throw new Error("contact insert did not persist");
  return created;
}

export async function patchContact(db: Db, id: string, patch: ContactPatch): Promise<ContactRow> {
  await db
    .update(schema.contact)
    .set({
      ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.customFields !== undefined ? { customFieldsJson: customFieldsJsonOf(patch.customFields) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, id));
  const updated = await findContactById(db, id);
  if (!updated) throw new Error(`contact ${id} not found after update`);
  return updated;
}

export interface ContactListResult {
  items: ContactRow[];
  total: number;
}

/** DEC-026 list: q (LIKE over name/email/company), segmentId (matchesSegment,
 * applied server-side over the pure core), sort name|recent, DEC-013 paging. */
export async function listContactsForOrg(db: Db, orgId: string, params: ParsedContactListQuery): Promise<ContactListResult> {
  const conditions = [eq(schema.contact.orgId, orgId)];
  if (params.q) {
    const like = `%${params.q}%`;
    conditions.push(
      or(
        sql`${schema.contact.firstName} LIKE ${like} COLLATE NOCASE`,
        sql`${schema.contact.lastName} LIKE ${like} COLLATE NOCASE`,
        sql`${schema.contact.email} LIKE ${like} COLLATE NOCASE`,
        sql`${schema.contact.company} LIKE ${like} COLLATE NOCASE`,
      )!,
    );
  }

  const rows = (await db.select().from(schema.contact).where(and(...conditions))).map(toRow);

  let filtered = rows;
  if (params.segmentId) {
    const segment = await findSegmentForOrg(db, params.segmentId, orgId);
    if (!segment) throw new Error(`segment ${params.segmentId} not found for org ${orgId}`);
    const segmentRules = JSON.parse(segment.rulesJson) as SegmentRule[];
    filtered = filtered.filter((r) => matchesSegment(segmentRules, toContactRecord(r)));
  }
  if (params.rules.length > 0) {
    filtered = filtered.filter((r) => matchesSegment(params.rules, toContactRecord(r)));
  }

  const sorted = [...filtered].sort(compareContacts(params.sort));
  const total = sorted.length;
  const start = (params.page - 1) * params.perPage;
  const items = sorted.slice(start, start + params.perPage);
  return { items, total };
}

// ---------------------------------------------------------------------------
// History (DEC-026: submissions + last 20 emails + distinct events)
// ---------------------------------------------------------------------------

export interface ContactHistorySubmission {
  id: string;
  ref: string;
  title: string;
  eventName: string;
  status: string;
}

export interface ContactHistoryEmail {
  id: string;
  subject: string;
  toEmail: string;
  status: string;
  sentAt: number;
}

export interface ContactHistory {
  submissions: ContactHistorySubmission[];
  emails: ContactHistoryEmail[];
  events: string[];
}

export async function getContactHistory(db: Db, contactId: string): Promise<ContactHistory> {
  const submissionRows = await db
    .select({
      id: schema.submission.id,
      title: schema.submission.title,
      status: schema.submission.status,
      seq: schema.submission.seq,
      eventName: schema.event.name,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(eq(schema.participant.contactId, contactId));

  const submissions: ContactHistorySubmission[] = submissionRows.map((r) => ({
    id: r.id,
    ref: formatRef(r.recordPrefix, r.seq),
    title: r.title,
    eventName: r.eventName,
    status: r.status,
  }));

  const emailRows = await db
    .select({
      id: schema.emailLog.id,
      subject: schema.emailLog.subject,
      toEmail: schema.emailLog.toEmail,
      status: schema.emailLog.status,
      sentAt: schema.emailLog.sentAt,
    })
    .from(schema.emailLog)
    .where(eq(schema.emailLog.contactId, contactId))
    .orderBy(desc(schema.emailLog.sentAt))
    .limit(20);

  const emails: ContactHistoryEmail[] = emailRows.map((r) => ({ ...r, sentAt: r.sentAt.getTime() }));

  const events = Array.from(new Set(submissions.map((s) => s.eventName)));

  return { submissions, emails, events };
}

// ---------------------------------------------------------------------------
// CSV import (DEC-011/DEC-026)
// ---------------------------------------------------------------------------

export interface ImportSkip {
  line: number;
  reason: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: ImportSkip[];
}

/** Applies parsed+mapped rows to the org's contacts, one row already resolved
 * per resolveImportUpsert. Rows are applied in order so within-file
 * duplicate emails collapse onto the same created contact. */
export async function applyImportRows(
  db: Db,
  orgId: string,
  rows: { line: number; parsed: Record<string, unknown> }[],
): Promise<ImportResult> {
  const existing = await db
    .select({ id: schema.contact.id, email: schema.contact.email })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const byEmail = new Map<string, string>();
  for (const r of existing) byEmail.set(r.email.trim().toLowerCase(), r.id);

  let created = 0;
  let updated = 0;
  const skipped: ImportSkip[] = [];

  for (const { line, parsed } of rows) {
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    if (!email || email.trim() === "") {
      skipped.push({ line, reason: "missing email" });
      continue;
    }
    const key = email.trim().toLowerCase();
    const existingId = byEmail.get(key);
    const decision = resolveImportUpsert(existingId, parsed as Partial<ContactRecord>);
    if (decision.action === "create") {
      const row = await createContact(db, orgId, decision.values);
      byEmail.set(key, row.id);
      created++;
    } else {
      await patchContact(db, decision.id, decision.patch);
      updated++;
    }
  }

  return { created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Duplicates + merge
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  contactIds: string[];
  contacts: { id: string; firstName: string; lastName: string; email: string }[];
}

export async function findDuplicateGroupsForOrg(db: Db, orgId: string): Promise<DuplicateGroup[]> {
  const rows = (await db.select().from(schema.contact).where(eq(schema.contact.orgId, orgId))).map(toRow);
  const records = rows.map(toContactRecord);
  const groups = findDuplicateGroups(records);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return groups.map((ids) => ({
    contactIds: ids,
    contacts: ids.map((id) => {
      const r = byId.get(id);
      if (!r) throw new Error(`duplicate group referenced unknown contact ${id}`);
      return { id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email };
    }),
  }));
}

/** Applies DEC-026/DEC-101 merge: planMerge onto the kept row, dedupes
 * participant rows the two contacts share a submission on (deleting mergeId's
 * duplicate row rather than repointing it into a UNIQUE-violating dupe),
 * repoints the six FK tables from mergeId to keepId, then deletes the merged
 * row. Both ids must already be verified org-scoped by the caller. Order is
 * load-bearing: dedupe-delete -> six repoints -> delete contact row. */
export async function mergeContacts(db: Db, keepId: string, mergeId: string): Promise<ContactRow> {
  const keepRow = await findContactById(db, keepId);
  const mergeRow = await findContactById(db, mergeId);
  if (!keepRow) throw new Error(`merge: keep contact ${keepId} not found`);
  if (!mergeRow) throw new Error(`merge: merge contact ${mergeId} not found`);

  const { merged } = planMerge(toContactRecord(keepRow), toContactRecord(mergeRow));

  await db
    .update(schema.contact)
    .set({
      firstName: merged.firstName,
      lastName: merged.lastName,
      email: merged.email,
      company: merged.company ?? null,
      title: merged.title ?? null,
      customFieldsJson: merged.customFields ? JSON.stringify(merged.customFields) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, keepId));

  // Dedupe participant rows BEFORE repointing: if both contacts are already
  // participants on the same submission, repointing mergeId's row onto
  // keepId would produce a duplicate participant for that submission, so we
  // delete mergeId's row for the shared submissions instead.
  const mergeParticipants = await db
    .select({ id: schema.participant.id, submissionId: schema.participant.submissionId })
    .from(schema.participant)
    .where(eq(schema.participant.contactId, mergeId));
  const keepParticipants = await db
    .select({ submissionId: schema.participant.submissionId })
    .from(schema.participant)
    .where(eq(schema.participant.contactId, keepId));
  const keepSubmissionIds = new Set(keepParticipants.map((p) => p.submissionId));
  const dupeParticipantIds = mergeParticipants
    .filter((p) => keepSubmissionIds.has(p.submissionId))
    .map((p) => p.id);
  for (const chunk of chunkIds(dupeParticipantIds)) {
    await db.delete(schema.participant).where(inArray(schema.participant.id, chunk));
  }

  const ops = buildMergeRepointOps(keepId, mergeId);
  for (const op of ops) {
    if (op.table === "participant") {
      await db.update(schema.participant).set({ contactId: op.to }).where(eq(schema.participant.contactId, op.from));
    } else if (op.table === "task_assignment") {
      await db.update(schema.taskAssignment).set({ contactId: op.to }).where(eq(schema.taskAssignment.contactId, op.from));
    } else if (op.table === "email_log") {
      await db.update(schema.emailLog).set({ contactId: op.to }).where(eq(schema.emailLog.contactId, op.from));
    } else if (op.table === "user") {
      await db.update(schema.user).set({ contactId: op.to }).where(eq(schema.user.contactId, op.from));
    } else if (op.table === "file") {
      await db.update(schema.file).set({ uploadedByContactId: op.to }).where(eq(schema.file.uploadedByContactId, op.from));
    } else {
      await db
        .update(schema.fileComment)
        .set({ authorContactId: op.to })
        .where(eq(schema.fileComment.authorContactId, op.from));
    }
  }

  await db.delete(schema.contact).where(eq(schema.contact.id, mergeId));

  const updated = await findContactById(db, keepId);
  if (!updated) throw new Error(`merge: keep contact ${keepId} missing after merge`);
  return updated;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface ContactStats {
  total: number;
  returningSpeakers: number;
  topCompanies: { company: string; count: number }[];
}

export async function getContactStats(db: Db, orgId: string): Promise<ContactStats> {
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const total = Number(totalRows[0]?.count ?? 0);

  const eventCountRows = await db
    .select({
      contactId: schema.contact.id,
      eventCount: sql<number>`count(distinct ${schema.submission.eventId})`,
    })
    .from(schema.contact)
    .innerJoin(schema.participant, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .where(eq(schema.contact.orgId, orgId))
    .groupBy(schema.contact.id);
  const returningSpeakers = eventCountRows.filter((r) => Number(r.eventCount) > 1).length;

  const companyRows = await db
    .select({ company: schema.contact.company, count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), sql`${schema.contact.company} is not null and ${schema.contact.company} != ''`))
    .groupBy(schema.contact.company)
    .orderBy(desc(sql`count(*)`))
    .limit(5);
  const topCompanies = companyRows
    .filter((r): r is { company: string; count: number } => r.company !== null)
    .map((r) => ({ company: r.company, count: Number(r.count) }));

  return { total, returningSpeakers, topCompanies };
}

// ---------------------------------------------------------------------------
// Segments (migrations/0005_w4_segment.sql, DEC-025/DEC-026)
// ---------------------------------------------------------------------------

export interface SegmentRow {
  id: string;
  orgId: string;
  name: string;
  rulesJson: string;
  createdAt: number;
  updatedAt: number;
}

function toSegmentRow(r: typeof schema.segment.$inferSelect): SegmentRow {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    rulesJson: r.rulesJson,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  };
}

export async function listSegmentsForOrg(db: Db, orgId: string): Promise<SegmentRow[]> {
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.orgId, orgId));
  return rows.map(toSegmentRow);
}

export async function findSegmentForOrg(db: Db, id: string, orgId: string): Promise<SegmentRow | null> {
  const rows = await db
    .select()
    .from(schema.segment)
    .where(and(eq(schema.segment.id, id), eq(schema.segment.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toSegmentRow(row) : null;
}

export async function createSegment(db: Db, orgId: string, name: string, rules: SegmentRule[]): Promise<SegmentRow> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.segment).values({
    id,
    orgId,
    name,
    rulesJson: JSON.stringify(rules),
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("segment insert did not persist");
  return toSegmentRow(row);
}

export async function patchSegment(db: Db, id: string, patch: { name?: string; rules?: SegmentRule[] }): Promise<SegmentRow> {
  await db
    .update(schema.segment)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.rules !== undefined ? { rulesJson: JSON.stringify(patch.rules) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.segment.id, id));
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`segment ${id} not found after update`);
  return toSegmentRow(row);
}

export async function deleteSegment(db: Db, id: string): Promise<void> {
  await db.delete(schema.segment).where(eq(schema.segment.id, id));
}

// ---------------------------------------------------------------------------
// Bulk email (DEC-019/DEC-026): contacts by id, org-scoped
// ---------------------------------------------------------------------------

export async function findContactsForOrg(db: Db, ids: string[], orgId: string): Promise<ContactRow[]> {
  if (ids.length === 0) return [];
  const rows: (typeof schema.contact.$inferSelect)[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select()
      .from(schema.contact)
      .where(and(eq(schema.contact.orgId, orgId), inArray(schema.contact.id, batch)));
    rows.push(...batchRows);
  }
  return rows.map(toRow);
}

export async function findUserIdByEmail(db: Db, email: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = lower(${email})`)
    .limit(1);
  return rows[0]?.id ?? null;
}
