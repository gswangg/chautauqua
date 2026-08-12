// Contacts repo: CRUD + list. Split out of repo/contacts.ts (contention
// decomposition, no behavior change). See repo/contacts.ts for the
// module-level contract notes.

import { and, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { matchesSegment, tokenizeContactQuery, type SegmentRule } from "../../../domain/contacts";
import { findSegmentForOrg } from "./segments";
import { toContactRecord, toRow, type ContactRow } from "./rows";
import { compareContacts, type ParsedContactListQuery } from "./query";
import { likeContains } from "../like";
import { backfillNullAttribution } from "../attribution";
import { ApiError } from "../../http";
import { DEC_333, DEC_336 } from "../../../decisions";

void DEC_333;
void DEC_336;

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
  if (patch.email !== undefined) {
    const current = await findContactById(db, id);
    if (!current) throw new Error(`contact ${id} not found`);
    const newEmailLower = patch.email.toLowerCase();
    if (newEmailLower !== current.email.toLowerCase()) {
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
    sql`${schema.contact.firstName} LIKE ${like} ESCAPE '\\' COLLATE NOCASE`,
    sql`${schema.contact.lastName} LIKE ${like} ESCAPE '\\' COLLATE NOCASE`,
    sql`${schema.contact.email} LIKE ${like} ESCAPE '\\' COLLATE NOCASE`,
    sql`coalesce(${schema.contact.company}, '') LIKE ${like} ESCAPE '\\' COLLATE NOCASE`,
  )!;
}

function orderByForSort(sort: "name" | "recent") {
  if (sort === "recent") {
    return sql`${schema.contact.updatedAt} desc, ${schema.contact.id} asc`;
  }
  return sql`lower(${schema.contact.lastName}) asc, lower(${schema.contact.firstName}) asc, ${schema.contact.id} asc`;
}

/** DEC-026 list: q (DEC-266 AND-tokens x OR-columns over name/email/company,
 * DEC-336 pushed fully into SQL — no JS filter/sort/slice on the default
 * directory path), segmentId/rules (DEC-149, matchesSegment over the pure
 * core — the one documented whole-directory load, DEC-336), sort
 * name|recent, DEC-013 paging. */
export async function listContactsForOrg(db: Db, orgId: string, params: ParsedContactListQuery): Promise<ContactListResult> {
  const conditions = [eq(schema.contact.orgId, orgId)];
  const tokens = params.q ? tokenizeContactQuery(params.q) : [];
  if (tokens.length > 0) {
    conditions.push(and(...tokens.map(tokenCondition))!);
  }
  const whereExpr = and(...conditions)!;

  if (params.segmentId === null && params.rules.length === 0) {
    // Default directory/search/sort/paging path: two SQL statements, no
    // whole-org materialization (DEC-333 scale rule).
    const totalRows = await db.select({ count: sql<number>`count(*)` }).from(schema.contact).where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    const offset = (params.page - 1) * params.perPage;
    const rows = await db
      .select()
      .from(schema.contact)
      .where(whereExpr)
      .orderBy(orderByForSort(params.sort))
      .limit(params.perPage)
      .offset(offset);
    return { items: rows.map(toRow), total };
  }

  // DEC-336: the one documented whole-directory path — segmentId/rules
  // evaluate matchesSegment (including custom.* JSON fields, which SQL
  // can't express) over every row the SQL q predicate above matched, then
  // sort/page in JS.
  const rows = (await db.select().from(schema.contact).where(whereExpr)).map(toRow);

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
