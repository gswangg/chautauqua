// Contacts repo: CRUD + list. Split out of repo/contacts.ts (contention
// decomposition, no behavior change). See repo/contacts.ts for the
// module-level contract notes.

import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId, formatRef } from "../../../domain/ids";
import { matchesSegment, tokenizeContactQuery, type ContactRecord, type SegmentRule } from "../../../domain/contacts";
import { findSegmentForOrg } from "./segments";
import { toRow, MAX_CONTACT_DIRECTORY_SCAN, type ContactRow } from "./rows";
import { compareContacts, type ParsedContactListQuery } from "./query";
import { likeContains } from "../like";
import { backfillNullAttribution } from "../attribution";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";
import { deleteDismissalsForContact } from "./merge";
import { touchSubmissionsForContacts } from "../submissions/touch";
import { DEC_333, DEC_336, DEC_554, DEC_758, DEC_770, DEC_864, DEC_979 } from "../../../decisions";

void DEC_333;
void DEC_336;
void DEC_554;
void DEC_758;
void DEC_770;
void DEC_864;
void DEC_979;

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

export function customFieldsJsonOf(customFields: Record<string, string> | null | undefined): string | null | undefined {
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

/** DEC-456: when an organizer edits a contact's email onto a value already
 * owned by a *different* user account, reject before any write — otherwise
 * the cascade below would silently steal that other account's login
 * identity. Checked against the contact's stored (pre-patch) email so a
 * same-contact re-save of its own address is never mistaken for a
 * conflict. */
export async function patchContact(db: Db, id: string, patch: ContactPatch): Promise<ContactRow> {
  // DEC-725 (wave-32 amendment): fetch the pre-patch name whenever the
  // patch touches it, so the write below can bump dependent submissions
  // only when the serialized string actually changes (never for an
  // email/phone/company/notes/headshot-only patch) — mirrors DEC-519's
  // same-string no-op rule. Reuses the existing pre-patch fetch that email
  // conflict checking already needs, so no duplicate read is added for the
  // common (email-editing) case.
  let current: ContactRow | null = null;
  if (patch.email !== undefined || patch.firstName !== undefined || patch.lastName !== undefined) {
    current = await findContactById(db, id);
    if (!current) throw new Error(`contact ${id} not found`);
  }
  if (patch.email !== undefined) {
    const newEmailLower = patch.email.toLowerCase();
    if (newEmailLower !== current!.email.toLowerCase()) {
      const conflicting = await db
        .select({ id: schema.user.id, contactId: schema.user.contactId })
        .from(schema.user)
        .where(sql`lower(${schema.user.email}) = ${newEmailLower}`)
        .limit(1);
      const owner = conflicting[0];
      if (owner && owner.contactId !== id) {
        throw new ApiError("conflict", "That email already belongs to another account");
      }
    }
  }
  const patchedAt = new Date();
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
      updatedAt: patchedAt,
    })
    .where(eq(schema.contact.id, id));
  // DEC-725 (wave-32 amendment): only firstName/lastName feed the SUBMISSION's
  // pushed Speakers cell — src/sync/airtable.ts builds it from
  // `${firstName} ${lastName}` alone; company/title are cells on the contact's
  // OWN pushed record, so patching them does not change any submission's
  // serialized shape. And because src/server/repo/overview.ts orders the
  // producer worklist by desc(submission.updatedAt), the touch must fire only
  // when the name string ACTUALLY changed (DEC-519's same-string no-op rule) —
  // a same-name resave must not reorder the producer's worklist.
  if (
    current &&
    ((patch.firstName !== undefined && patch.firstName !== current.firstName) ||
      (patch.lastName !== undefined && patch.lastName !== current.lastName))
  ) {
    await touchSubmissionsForContacts(db, [id], patchedAt);
  }
  // DEC-456: cascade the (already-conflict-checked) new email onto this
  // contact's linked user row, if any, so login identity never drifts out
  // of sync with the CRM's record of the contact's address.
  if (patch.email !== undefined) {
    await db
      .update(schema.user)
      .set({ email: patch.email.toLowerCase(), updatedAt: new Date() })
      .where(eq(schema.user.contactId, id));
  }
  // DEC-299: repair any never-taken (NULL) attribution snapshot now that an
  // organizer has written a real title/company onto this contact.
  if (patch.title !== undefined || patch.company !== undefined) {
    await backfillNullAttribution(db, id, { title: patch.title ?? null, company: patch.company ?? null });
  }
  const updated = await findContactById(db, id);
  if (!updated) throw new Error(`contact ${id} not found after update`);
  return updated;
}

export interface ContactReferenceRows {
  submissions: { id: string; ref: string; title: string; eventName: string }[];
  tasks: { id: string; title: string; eventName: string }[];
  pipelineEntries: { id: string; stage: string }[];
  userAccounts: { id: string; email: string }[];
  more: { submissions: number; tasks: number; pipelineEntries: number; userAccounts: number };
}

/** DEC-956: bounded one-query-per-class READ of the actual rows that would
 * dangle if this contact were deleted, not just their counts — the refusal
 * at the route names them so an organiser can act. Each query joins through
 * to the owning event for display (participant->submission->event,
 * task_assignment->task->event), orders by id for a deterministic slice,
 * and caps at 6 rows via `count(*) over ()` (a window function computed
 * over the full matching set BEFORE the LIMIT trims the output) so a single
 * query yields both the first 5 rows to name and the exact remainder count
 * — never a second query, never a query per row (DEC-078/DEC-418). */
export async function listContactReferenceRows(db: Db, contactId: string): Promise<ContactReferenceRows> {
  const [submissionRows, taskRows, pipelineRows, userRows] = await Promise.all([
    db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        eventName: schema.event.name,
        recordPrefix: schema.event.recordPrefix,
        total: sql<number>`count(*) over ()`,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
      .where(eq(schema.participant.contactId, contactId))
      .orderBy(schema.submission.id)
      .limit(6),
    db
      .select({
        id: schema.task.id,
        title: schema.task.title,
        eventName: schema.event.name,
        total: sql<number>`count(*) over ()`,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
      .where(eq(schema.taskAssignment.contactId, contactId))
      .orderBy(schema.task.id)
      .limit(6),
    db
      .select({
        id: schema.pipelineEntry.id,
        stage: schema.pipelineEntry.stage,
        total: sql<number>`count(*) over ()`,
      })
      .from(schema.pipelineEntry)
      .where(eq(schema.pipelineEntry.contactId, contactId))
      .orderBy(schema.pipelineEntry.id)
      .limit(6),
    db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        total: sql<number>`count(*) over ()`,
      })
      .from(schema.user)
      .where(eq(schema.user.contactId, contactId))
      .orderBy(schema.user.id)
      .limit(6),
  ]);

  const remainder = (total: number | undefined) => Math.max(Number(total ?? 0) - 5, 0);

  return {
    submissions: submissionRows
      .slice(0, 5)
      .map((r) => ({ id: r.id, ref: formatRef(r.recordPrefix, r.seq), title: r.title, eventName: r.eventName })),
    tasks: taskRows.slice(0, 5).map((r) => ({ id: r.id, title: r.title, eventName: r.eventName })),
    pipelineEntries: pipelineRows.slice(0, 5).map((r) => ({ id: r.id, stage: r.stage })),
    userAccounts: userRows.slice(0, 5).map((r) => ({ id: r.id, email: r.email })),
    more: {
      submissions: remainder(submissionRows[0]?.total),
      tasks: remainder(taskRows[0]?.total),
      pipelineEntries: remainder(pipelineRows[0]?.total),
      userAccounts: remainder(userRows[0]?.total),
    },
  };
}

/** DEC-979: only reachable once the route has refused on submissions
 * (participant) and userAccounts refs — task_assignment and pipeline_entry
 * (+ its pipeline_activity feed) are NOT independent refusal classes, they
 * are cascade-deleted here so a contact whose only references are tasks
 * and/or sourcing-pipeline history is actually deletable (DEC-921 keeps a
 * speaker's task assignments after their only session is deleted, which
 * previously made them permanently undeletable). Set-based and chunked:
 * select this contact's pipeline_entry ids, delete their pipeline_activity
 * rows (chunked by entryId), delete the pipeline_entry rows, delete this
 * contact's task_assignment rows, then delete the contact row itself.
 *
 * DEC-979 (wave-43 amendment): every member of CONTACT_FK_TABLES
 * (src/server/repo/contacts/query.ts) falls into exactly one of three
 * classes here, and this function must account for all seven:
 *   - REFUSED-BEFORE (user, participant): the route refuses on these refs
 *     before deleteContact is ever reached — see
 *     test/contact-delete-refusal-rows.test.ts.
 *   - CASCADE-DELETED (task_assignment, pipeline_entry): JOIN rows, not
 *     documents, deleted above along with pipeline_entry's
 *     pipeline_activity feed.
 *   - NULLED, never deleted (email_log.contact_id, file.uploaded_by_contact_id,
 *     file_comment.author_contact_id): these are durable audit/provenance
 *     records whose row must survive the contact's deletion. DEC-006
 *     stores an email_log row's rendered subject/body inline alongside
 *     to_email, so the row stays fully self-describing with contact_id
 *     NULL -- deleting it instead would erase J5's per-recipient send
 *     history. All three columns are already nullable, so NULLing them is
 *     schema-safe and mirrors mergeContacts' repoint (merge.ts), which
 *     points these same three FKs at the surviving contact instead of
 *     deleting them -- here there is no survivor, so NULL is the closest
 *     equivalent that still keeps the audit row intact. */
export async function deleteContact(db: Db, contactId: string): Promise<void> {
  const entryRows = await db
    .select({ id: schema.pipelineEntry.id })
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.contactId, contactId));
  const entryIds = entryRows.map((r) => r.id);
  for (const batch of chunkIds(entryIds)) {
    await db.delete(schema.pipelineActivity).where(inArray(schema.pipelineActivity.entryId, batch));
  }
  await db.delete(schema.pipelineEntry).where(eq(schema.pipelineEntry.contactId, contactId));
  await db.delete(schema.taskAssignment).where(eq(schema.taskAssignment.contactId, contactId));
  // DEC-770 amendment (wave 48): a duplicate-dismissal judged this contact
  // against another, so deleting the contact leaves a stale judgement --
  // delete it too (never repoint, there is no survivor to repoint it onto),
  // before the contact row itself is gone.
  await deleteDismissalsForContact(db, contactId);
  // DEC-979 (wave-43 amendment): NULL (never delete) the three audit/
  // provenance FKs so email_log/file/file_comment rows survive the
  // contact's deletion instead of dangling on an unresolvable id.
  await db.update(schema.emailLog).set({ contactId: null }).where(eq(schema.emailLog.contactId, contactId));
  await db.update(schema.file).set({ uploadedByContactId: null }).where(eq(schema.file.uploadedByContactId, contactId));
  await db
    .update(schema.fileComment)
    .set({ authorContactId: null })
    .where(eq(schema.fileComment.authorContactId, contactId));
  await db.delete(schema.contact).where(eq(schema.contact.id, contactId));
}

export interface ContactListResult {
  items: ContactRow[];
  total: number;
}

/** DEC-336: exact per-token predicate (AND-across-tokens x OR-across-
 * columns over firstName/lastName/email/company), each column compared
 * case-insensitively via a LIKE with escaped metacharacters (likeContains).
 * No superset/narrow-in-JS step — this IS the true predicate. */
function tokenCondition(token: string) {
  const like = likeContains(token);
  return or(
    sql`${schema.contact.firstName} LIKE ${like} ESCAPE '\\'`,
    sql`${schema.contact.lastName} LIKE ${like} ESCAPE '\\'`,
    sql`${schema.contact.email} LIKE ${like} ESCAPE '\\'`,
    sql`coalesce(${schema.contact.company}, '') LIKE ${like} ESCAPE '\\'`,
  )!;
}

function orderByForSort(sort: "name" | "recent") {
  if (sort === "recent") {
    return sql`${schema.contact.updatedAt} desc, ${schema.contact.id} asc`;
  }
  return sql`lower(${schema.contact.lastName}) asc, lower(${schema.contact.firstName}) asc, ${schema.contact.id} asc`;
}

/** Shared q-tokenization SQL predicate (DEC-266/DEC-336), reused by both the
 * paged list (listContactsForOrg) and the unpaged export row selection
 * (selectFilteredContactRows) so the two never drift. */
function buildContactWhereExpr(orgId: string, params: ParsedContactListQuery) {
  const conditions = [eq(schema.contact.orgId, orgId)];
  const tokens = params.q ? tokenizeContactQuery(params.q) : [];
  if (tokens.length > 0) {
    conditions.push(and(...tokens.map(tokenCondition))!);
  }
  return and(...conditions)!;
}

interface ScanRecord extends ContactRecord {
  updatedAt: number;
}

/** Extracted scan+guard shared by `scanAndFilterContacts` (org+q+segment/
 * rules predicate) and `countContactsForSegmentRules` (org-scope-only
 * predicate, DEC-864) — same narrow projection, same refuse-rather-than-
 * truncate MAX_CONTACT_DIRECTORY_SCAN guard, one piece of code either way. */
async function scanOrgContactRecords(db: Db, orgId: string, whereExpr: ReturnType<typeof buildContactWhereExpr>): Promise<ScanRecord[]> {
  void orgId; // orgId is already folded into whereExpr by the caller
  const scanRows = await db
    .select({
      id: schema.contact.id,
      email: schema.contact.email,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
      title: schema.contact.title,
      customFieldsJson: schema.contact.customFieldsJson,
      updatedAt: schema.contact.updatedAt,
    })
    .from(schema.contact)
    .where(whereExpr)
    .orderBy(schema.contact.id)
    .limit(MAX_CONTACT_DIRECTORY_SCAN + 1);

  if (scanRows.length > MAX_CONTACT_DIRECTORY_SCAN) {
    throw new ApiError(
      "invalid",
      `This segment/rules filter would scan more than ${MAX_CONTACT_DIRECTORY_SCAN} contacts — narrow with the search box first (the q filter runs in SQL and composes with segment/rules)`,
    );
  }

  return scanRows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    ...(r.company ? { company: r.company } : {}),
    ...(r.title ? { title: r.title } : {}),
    ...(r.customFieldsJson ? { customFields: JSON.parse(r.customFieldsJson) as Record<string, string> } : {}),
    updatedAt: r.updatedAt.getTime(),
  }));
}

/** DEC-336/DEC-554: the segmentId/rules whole-directory scan — bounded and
 * narrow (MAX_CONTACT_DIRECTORY_SCAN guard, refuse rather than truncate),
 * projecting only the columns matchesSegment/compareContacts read. Returns
 * every matching record, sorted, with NO page window — callers that need a
 * page slice it themselves; callers that need every row (export) use it as
 * is. Shared by listContactsForOrg's scan branch and
 * selectFilteredContactRows so the guard/predicate is one piece of code. */
async function scanAndFilterContacts(db: Db, orgId: string, params: ParsedContactListQuery): Promise<ScanRecord[]> {
  const whereExpr = buildContactWhereExpr(orgId, params);
  const scanRecords = await scanOrgContactRecords(db, orgId, whereExpr);

  let filtered = scanRecords;
  if (params.segmentId) {
    const segment = await findSegmentForOrg(db, params.segmentId, orgId);
    if (!segment) throw new Error(`segment ${params.segmentId} not found for org ${orgId}`);
    const segmentRules = JSON.parse(segment.rulesJson) as SegmentRule[];
    filtered = filtered.filter((r) => matchesSegment(segmentRules, r as ContactRecord));
  }
  if (params.rules.length > 0) {
    filtered = filtered.filter((r) => matchesSegment(params.rules, r as ContactRecord));
  }

  return [...filtered].sort(compareContacts(params.sort));
}

/** DEC-864: the GET /segments rail — instead of one whole-directory scan per
 * segment (the old segmentCount(...) calling listContactsForOrg once per
 * row), scan the org's contacts ONCE (org scope only, no q/segment
 * predicate) and evaluate every ruleSet's matchesSegment against that single
 * in-memory pass. Same matchesSegment used by the paged list/scan branch
 * above, so a rail caption and the filtered list it drills into stay the
 * same arithmetic fact — only the cost changes. Order of the returned counts
 * matches the order of ruleSets. An empty rule set counts every scanned row,
 * matching matchesSegment's own empty-rules-matches-everything behavior. */
export async function countContactsForSegmentRules(db: Db, orgId: string, ruleSets: SegmentRule[][]): Promise<number[]> {
  const whereExpr = eq(schema.contact.orgId, orgId);
  const rows = await scanOrgContactRecords(db, orgId, whereExpr);
  return ruleSets.map((rules) => rows.filter((r) => matchesSegment(rules, r as ContactRecord)).length);
}

/** DEC-671: the export row-selection half of listContactsForOrg — same q
 * predicate, same segmentId/rules matchesSegment pass, same
 * MAX_CONTACT_DIRECTORY_SCAN guard (fail loudly rather than silently
 * exporting an unfiltered file), but returns EVERY matching row, never a
 * page window.
 *
 * DEC-027 amendment (wave 50): `limit`, when supplied, bounds the row query
 * itself (never a post-fetch slice) — the caller (exportContacts) passes
 * EXPORT_MAX_ROWS + 1 so an overflow can be detected from the returned
 * array length. The segment/rules scan branch is already bounded by
 * MAX_CONTACT_DIRECTORY_SCAN independently of this `limit`; when `limit` is
 * smaller, the scanned/filtered set is truncated to `limit + 1` too so the
 * two branches agree on what "overflow" means to the caller. */
export async function selectFilteredContactRows(
  db: Db,
  orgId: string,
  params: ParsedContactListQuery,
  limit?: number,
): Promise<ContactRow[]> {
  if (params.segmentId === null && params.rules.length === 0) {
    const whereExpr = buildContactWhereExpr(orgId, params);
    const baseQuery = db.select().from(schema.contact).where(whereExpr).orderBy(orderByForSort(params.sort));
    const rows = limit !== undefined ? await baseQuery.limit(limit) : await baseQuery;
    return rows.map(toRow);
  }

  const sorted = await scanAndFilterContacts(db, orgId, params);
  const ids = (limit !== undefined ? sorted.slice(0, limit) : sorted).map((r) => r.id);
  const fullRowsById = new Map<string, ContactRow>();
  const batches = await Promise.all(
    chunkIds(ids).map((batch) => db.select().from(schema.contact).where(inArray(schema.contact.id, batch))),
  );
  for (const rows of batches) {
    for (const row of rows) {
      const mapped = toRow(row);
      fullRowsById.set(mapped.id, mapped);
    }
  }
  return ids.map((id) => {
    const row = fullRowsById.get(id);
    if (!row) throw new Error(`contact ${id} not found during segment scan re-hydration`);
    return row;
  });
}

/** DEC-026 list: q (DEC-266 AND-tokens x OR-columns over name/email/company,
 * DEC-336 pushed fully into SQL — no JS filter/sort/slice on the default
 * directory path), segmentId/rules (DEC-149, matchesSegment over the pure
 * core — the one documented whole-directory load, DEC-336), sort
 * name|recent, DEC-013 paging. */
export async function listContactsForOrg(db: Db, orgId: string, params: ParsedContactListQuery): Promise<ContactListResult> {
  const whereExpr = buildContactWhereExpr(orgId, params);

  if (params.segmentId === null && params.rules.length === 0) {
    // Default directory/search/sort/paging path: two SQL statements, no
    // whole-org materialization (DEC-333 scale rule).
    const offset = (params.page - 1) * params.perPage;
    const [totalRows, rows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.contact).where(whereExpr),
      db
        .select()
        .from(schema.contact)
        .where(whereExpr)
        .orderBy(orderByForSort(params.sort))
        .limit(params.perPage)
        .offset(offset),
    ]);
    const total = Number(totalRows[0]?.count ?? 0);
    return { items: rows.map(toRow), total };
  }

  // DEC-336/DEC-554: the one documented whole-directory path — segmentId/
  // rules evaluate matchesSegment (including custom.* JSON fields, which SQL
  // can't express) over every row the SQL q predicate above matched, then
  // sort/page in JS. The scan itself is bounded and narrow (DEC-554,
  // scanAndFilterContacts): it projects only the columns
  // matchesSegment/compareContacts read, refuses above
  // MAX_CONTACT_DIRECTORY_SCAN rather than silently truncating, and only the
  // final page's full rows are re-hydrated from the db.
  const sorted = await scanAndFilterContacts(db, orgId, params);
  const total = sorted.length;
  const start = (params.page - 1) * params.perPage;
  const page = sorted.slice(start, start + params.perPage);

  // Re-hydrate only the paged ids' full rows, then re-order to match the
  // paged order (DEC-554: never widen the scan itself back into full rows).
  const pageIds = page.map((r) => r.id);
  const fullRowsById = new Map<string, ContactRow>();
  const batches = await Promise.all(
    chunkIds(pageIds).map((batch) => db.select().from(schema.contact).where(inArray(schema.contact.id, batch))),
  );
  for (const rows of batches) {
    for (const row of rows) {
      const mapped = toRow(row);
      fullRowsById.set(mapped.id, mapped);
    }
  }
  const items = pageIds.map((id) => {
    const row = fullRowsById.get(id);
    if (!row) throw new Error(`contact ${id} not found during segment scan re-hydration`);
    return row;
  });

  return { items, total };
}
