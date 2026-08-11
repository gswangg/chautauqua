// Contacts repo: CRUD + list. Split out of repo/contacts.ts (contention
// decomposition, no behavior change). See repo/contacts.ts for the
// module-level contract notes.

import { and, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { matchesContactQuery, matchesSegment, tokenizeContactQuery, type SegmentRule } from "../../../domain/contacts";
import { findSegmentForOrg } from "./segments";
import { toContactRecord, toRow, type ContactRow } from "./rows";
import { compareContacts, type ParsedContactListQuery } from "./query";

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
