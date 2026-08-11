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
  matchesContactQuery,
  matchesSegment,
  planMerge,
  tokenizeContactQuery,
  type ContactRecord,
  type SegmentRule,
} from "../../domain/contacts";
import { createSubmission } from "./submissions/create";
import { updateSubmissionStatuses } from "./submissions";
import { parseSocialLinks, serializeSocialLinks } from "./profile";
import { DEC_156 } from "../../decisions";
import { ApiError } from "../http";

// Compile-checked dependency marker: pushContactToEvent below implements
// DEC-156's push-to-event contract (accepted submission, pending content,
// no email).
void DEC_156;

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

/** Projects a DB row into the pure-core ContactRecord shape (custom fields
 * parsed, social links parsed via the profile repo's shared helper — DEC-
 * 167: every persisted field the merge domain reasons about is threaded
 * through here so a duplicate-only value survives planMerge). */
export function toContactRecord(row: ContactRow): ContactRecord {
  const socialLinks = parseSocialLinks(row.socialLinksJson);
  const hasSocialLinks = Object.values(socialLinks).some((v) => v !== "");
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    ...(row.company ? { company: row.company } : {}),
    ...(row.title ? { title: row.title } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.bio ? { bio: row.bio } : {}),
    ...(row.headshotUrl ? { headshotUrl: row.headshotUrl } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(hasSocialLinks ? { socialLinks } : {}),
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

/** DEC-282: every table with a *_id column pointing at contact.id must be
 * repointed on merge. This is the exhaustive list — the schema-tripwire
 * test in test/contacts-merge-integrity.test.ts walks src/db/schema.ts and
 * fails loudly if a new contact-referencing table is added here without
 * being enumerated. pipeline_entry was the DEC-282 gap: it was omitted,
 * so listPipelineForOrg threw "references missing contact" for the whole
 * org after any merge (the merged contact's pipeline_entry row was never
 * repointed before the contact row was deleted). */
export const CONTACT_FK_TABLES = [
  "user",
  "participant",
  "task_assignment",
  "email_log",
  "file",
  "file_comment",
  "pipeline_entry",
] as const;
export type MergeRepointTable = (typeof CONTACT_FK_TABLES)[number];

export interface MergeRepointOp {
  table: MergeRepointTable;
  from: string;
  to: string;
}

/**
 * Plans the DEC-282 FK repoints on merge (participant, task_assignment,
 * email_log, user.contact_id, file.uploaded_by_contact_id,
 * file_comment.author_contact_id, pipeline_entry.contact_id) before the
 * duplicate row is deleted. Fails loudly if asked to merge a contact into
 * itself.
 */
export function buildMergeRepointOps(keepId: string, mergeId: string): MergeRepointOp[] {
  if (keepId === mergeId) {
    throw new Error("buildMergeRepointOps: keepId and mergeId must differ");
  }
  return CONTACT_FK_TABLES.map((table) => ({
    table,
    from: mergeId,
    to: keepId,
  }));
}

/** Local union, not imported from ./pipeline, to avoid a module cycle
 * (pipeline.ts's PipelineStage is structurally identical). */
export type PipelineStageLike = "identified" | "contacted" | "interested" | "confirmed" | "declined";

const PIPELINE_STAGE_RANK: Record<PipelineStageLike, number> = {
  identified: 0,
  contacted: 1,
  interested: 2,
  confirmed: 3,
  declined: -1,
};

/** DEC-282: picks the surviving stage when both contacts being merged are
 * enrolled in the pipeline. null means "not enrolled" (a missing
 * pipeline_entry row) — if only one side is enrolled, that side's stage
 * wins outright. If both are enrolled, the further-along stage wins by
 * rank (declined is deliberately rank -1 so it never displaces genuine
 * progress just because it's "later" chronologically); equal rank keeps
 * the kept contact's own value. */
export function mergedPipelineStage(
  keep: PipelineStageLike | null,
  merge: PipelineStageLike | null,
): PipelineStageLike | null {
  if (keep === null && merge === null) return null;
  if (keep === null) return merge;
  if (merge === null) return keep;
  const keepRank = PIPELINE_STAGE_RANK[keep];
  const mergeRank = PIPELINE_STAGE_RANK[merge];
  if (mergeRank > keepRank) return merge;
  return keep;
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
  // Admin editing of speaker profile (CNT-10, DEC-152: reuses the portal
  // profile plumbing) — already-serialized JSON string, produced by the
  // caller via serializeSocialLinks (src/server/repo/profile.ts) so this
  // repo layer stays agnostic of the SocialLinks shape.
  socialLinksJson?: string | null;
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
      ...(patch.socialLinksJson !== undefined ? { socialLinksJson: patch.socialLinksJson } : {}),
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

/** DEC-026 list: q (DEC-266 AND-tokens x OR-columns over name/email/company),
 * segmentId (matchesSegment, applied server-side over the pure core), sort
 * name|recent, DEC-013 paging. */
export async function listContactsForOrg(db: Db, orgId: string, params: ParsedContactListQuery): Promise<ContactListResult> {
  const conditions = [eq(schema.contact.orgId, orgId)];
  const tokens = params.q ? tokenizeContactQuery(params.q) : [];
  if (tokens.length > 0) {
    // Superset SQL prefilter (DEC-266): OR every token across every
    // searched column. The true predicate is AND-across-tokens x
    // OR-across-columns, which this OR-of-everything can only ever be a
    // superset of — any row the true predicate matches necessarily has at
    // least one token matching at least one column, so it necessarily
    // satisfies this OR. It can never drop a true match; matchesContactQuery
    // below (same in-memory pass as matchesSegment) narrows it to the exact
    // AND x OR result.
    const perToken = tokens.map((token) => {
      const like = `%${token}%`;
      return or(
        sql`${schema.contact.firstName} LIKE ${like} COLLATE NOCASE`,
        sql`${schema.contact.lastName} LIKE ${like} COLLATE NOCASE`,
        sql`${schema.contact.email} LIKE ${like} COLLATE NOCASE`,
        sql`${schema.contact.company} LIKE ${like} COLLATE NOCASE`,
      )!;
    });
    conditions.push(or(...perToken)!);
  }

  const rows = (await db.select().from(schema.contact).where(and(...conditions))).map(toRow);

  let filtered = rows;
  if (tokens.length > 0) {
    filtered = filtered.filter((r) => matchesContactQuery(tokens, toContactRecord(r)));
  }
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

/** Applies DEC-026/DEC-101/DEC-282 merge, in this exact load-bearing order:
 *  (a) BEFORE any write, load both contacts' user rows; if both have a
 *      login account, throw a conflict (no partial merge — a merge that
 *      silently orphaned one login would be worse than refusing it).
 *  (b) planMerge onto the kept contact row.
 *  (c) dedupe participant rows the two contacts share a submission on
 *      (deleting mergeId's duplicate row rather than repointing it into a
 *      UNIQUE-violating dupe).
 *  (d) dedupe task_assignment rows the two contacts share a task on,
 *      keeping whichever row is 'complete' (completion is never lost).
 *  (e) if both contacts are enrolled in the CRM pipeline, repoint
 *      pipeline_activity onto the kept entry, merge the stage
 *      (mergedPipelineStage), and delete the merged entry.
 *  (f) repoint the seven CONTACT_FK_TABLES from mergeId to keepId.
 *  (g) delete the merged contact row.
 * Both ids must already be verified org-scoped by the caller. */
export async function mergeContacts(db: Db, keepId: string, mergeId: string): Promise<ContactRow> {
  const keepRow = await findContactById(db, keepId);
  const mergeRow = await findContactById(db, mergeId);
  if (!keepRow) throw new Error(`merge: keep contact ${keepId} not found`);
  if (!mergeRow) throw new Error(`merge: merge contact ${mergeId} not found`);

  // (a) Login-account conflict check, before any write.
  const keepUserRows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.contactId, keepId))
    .limit(1);
  const mergeUserRows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.contactId, mergeId))
    .limit(1);
  if (keepUserRows.length > 0 && mergeUserRows.length > 0) {
    throw new ApiError("conflict", "Both contacts have a login account; remove one account before merging");
  }

  // (b) planMerge onto the kept row.
  const { merged } = planMerge(toContactRecord(keepRow), toContactRecord(mergeRow));

  await db
    .update(schema.contact)
    .set({
      firstName: merged.firstName,
      lastName: merged.lastName,
      email: merged.email,
      company: merged.company ?? null,
      title: merged.title ?? null,
      phone: merged.phone ?? null,
      bio: merged.bio ?? null,
      headshotUrl: merged.headshotUrl ?? null,
      notes: merged.notes ?? null,
      socialLinksJson: merged.socialLinks ? serializeSocialLinks(merged.socialLinks) : null,
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

  // (d) Dedupe task_assignment rows the two contacts share a task on, same
  // shape as the participant dedupe above (repointing onto keepId would
  // otherwise produce two assignment rows for the same task). Completion is
  // never lost: if exactly one side is 'complete', that side's row survives.
  const mergeTasks = await db
    .select({ id: schema.taskAssignment.id, taskId: schema.taskAssignment.taskId, status: schema.taskAssignment.status })
    .from(schema.taskAssignment)
    .where(eq(schema.taskAssignment.contactId, mergeId));
  const keepTasks = await db
    .select({ id: schema.taskAssignment.id, taskId: schema.taskAssignment.taskId, status: schema.taskAssignment.status })
    .from(schema.taskAssignment)
    .where(eq(schema.taskAssignment.contactId, keepId));
  const keepTaskById = new Map(keepTasks.map((t) => [t.taskId, t]));
  const dupeTaskAssignmentIds: string[] = [];
  for (const mergeTask of mergeTasks) {
    const keepTask = keepTaskById.get(mergeTask.taskId);
    if (!keepTask) continue;
    const mergeComplete = mergeTask.status === "complete";
    const keepComplete = keepTask.status === "complete";
    // Delete the merged row unless it's the only completed one, in which
    // case delete the kept row instead so completion survives.
    if (mergeComplete && !keepComplete) {
      dupeTaskAssignmentIds.push(keepTask.id);
    } else {
      dupeTaskAssignmentIds.push(mergeTask.id);
    }
  }
  for (const chunk of chunkIds(dupeTaskAssignmentIds)) {
    await db.delete(schema.taskAssignment).where(inArray(schema.taskAssignment.id, chunk));
  }

  // (e) Pipeline handling (DEC-282): if both contacts are enrolled, the
  // merged entry's activity feed is repointed onto the kept entry, the kept
  // entry's stage becomes the further-along of the two (mergedPipelineStage
  // — declined never displaces real progress), and the merged entry row is
  // deleted so it isn't left dangling for (f)'s generic repoint to touch.
  // If only one side is enrolled, there's nothing to reconcile here — (f)'s
  // generic pipeline_entry repoint below handles that case on its own.
  const keepEntryRows = await db
    .select({ id: schema.pipelineEntry.id, stage: schema.pipelineEntry.stage })
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.contactId, keepId))
    .limit(1);
  const mergeEntryRows = await db
    .select({ id: schema.pipelineEntry.id, stage: schema.pipelineEntry.stage })
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.contactId, mergeId))
    .limit(1);
  const keepEntry = keepEntryRows[0];
  const mergeEntry = mergeEntryRows[0];
  if (keepEntry && mergeEntry) {
    // Both entries exist, so mergedPipelineStage's null branches (either
    // side "not enrolled") are unreachable here; the cast reflects that.
    const nextStage = mergedPipelineStage(
      keepEntry.stage as PipelineStageLike,
      mergeEntry.stage as PipelineStageLike,
    ) as PipelineStageLike;
    await db
      .update(schema.pipelineActivity)
      .set({ entryId: keepEntry.id })
      .where(eq(schema.pipelineActivity.entryId, mergeEntry.id));
    await db
      .update(schema.pipelineEntry)
      .set({ stage: nextStage, updatedAt: new Date() })
      .where(eq(schema.pipelineEntry.id, keepEntry.id));
    await db.delete(schema.pipelineEntry).where(eq(schema.pipelineEntry.id, mergeEntry.id));
  }

  // (f) Generic FK repoints (DEC-282, CONTACT_FK_TABLES).
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
    } else if (op.table === "file_comment") {
      await db
        .update(schema.fileComment)
        .set({ authorContactId: op.to })
        .where(eq(schema.fileComment.authorContactId, op.from));
    } else {
      await db.update(schema.pipelineEntry).set({ contactId: op.to }).where(eq(schema.pipelineEntry.contactId, op.from));
    }
  }

  // (g) Delete the merged contact row.
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
  eventCount: number;
  returningSpeakers: number;
  topCompanies: { company: string; count: number }[];
}

export async function getContactStats(db: Db, orgId: string): Promise<ContactStats> {
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const total = Number(totalRows[0]?.count ?? 0);

  // CRM-12 dashboard KPI: total events the org runs (not per-contact).
  const orgEventCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.event)
    .where(eq(schema.event.orgId, orgId));
  const eventCount = Number(orgEventCountRows[0]?.count ?? 0);

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

  return { total, eventCount, returningSpeakers, topCompanies };
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

// ---------------------------------------------------------------------------
// Push to event (CRM-10, DEC-156)
// ---------------------------------------------------------------------------

/**
 * Pushes an already-org-owned contact into an event as an organizer-invited
 * submission: status 'accepted', content_status left at its default
 * 'pending' (createSubmission's default), title defaulting to
 * 'Invited: <FirstName> <LastName>', and the contact as a visible
 * participant. Reuses createSubmission's contact-linking plumbing
 * (findOrCreateContact matches this contact's own email, so no duplicate
 * contact is created) rather than hand-rolling submission/participant
 * inserts. Sends no email. Caller is expected to have already verified the
 * contact and event both belong to the caller's org.
 *
 * P1 fix (w1-f): this used to insert the submission directly with
 * status: 'accepted', which skips updateSubmissionStatuses's acceptance
 * planner entirely (that only fires on a tracked pending->accepted
 * transition, DEC-079) — so a CRM-pushed contact never got the event's
 * assignToAllAccepted onboarding tasks and was invisible on the Speakers
 * onboarding grid (src/server/repo/tasks.ts's getOnboardingGrid renders
 * task_assignment rows, not submissions). Creating as 'pending' and then
 * driving it through updateSubmissionStatuses (the same path triage/bulk
 * accept uses) runs that planner so the contact gets onboarding tasks and
 * shows up on Speakers, while still sending no email (DEC-009 invariant #1
 * — updateSubmissionStatuses has no mailer import) and reaching the exact
 * same final status='accepted' DEC-156 requires.
 */
export async function pushContactToEvent(
  db: Db,
  eventId: string,
  orgId: string,
  contact: Pick<ContactRow, "email" | "firstName" | "lastName">,
  title: string | undefined,
): Promise<string> {
  const resolvedTitle = title && title.trim() ? title.trim() : `Invited: ${contact.firstName} ${contact.lastName}`;
  const submissionId = await createSubmission(db, eventId, orgId, {
    title: resolvedTitle,
    contact: { email: contact.email, firstName: contact.firstName, lastName: contact.lastName },
  });
  await updateSubmissionStatuses(db, eventId, [submissionId], "accepted", new Date());
  return submissionId;
}
