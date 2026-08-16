// Shared helpers for the CRM API (J11) submodules under this directory —
// split out of the former monolithic src/routes/api/contacts.ts for
// contention (803-line hotspot) reasons only; no behavior change.

import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import * as schema from "../../../db/schema";
import type { Db } from "../../../server/context";
import type { SegmentRule } from "../../../domain/contacts";
import { chunkIds } from "../../../lib/chunk";
import { overBudgetBy } from "../../../domain/count-copy";
import { parseSocialLinks } from "../../../server/repo/profile";

export function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
}

export function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// DEC-417 (amendment DEC-422): the fields-map value names the overage the
// same way the portal's refusal sentence does (overBudgetBy, src/domain/
// count-copy.ts), so the CRM drawer marks the field AND states how far over
// it is, not just a bare "Max N".
export function checkLen(value: string, field: string, max: number, fields: Record<string, string>): void {
  if (value.length > max) fields[field] = overBudgetBy(value.length, max);
}

export function serializeContact(row: repo.ContactRow) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    bio: row.bio,
    headshotUrl: row.headshotUrl,
    notes: row.notes,
    // customFieldsJson has no declared parser yet (unlike social_links_json's
    // parseSocialLinks) -- left as a hand-parse this wave per DEC-152 scope.
    customFields: row.customFieldsJson ? JSON.parse(row.customFieldsJson) : null,
    // DEC-152 (wave-76 amendment): route through the declared parser so this
    // is no longer the last hand-parse of social_links_json on the wire --
    // always returns all four keys as strings, never null.
    socialLinks: parseSocialLinks(row.socialLinksJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeSegment(row: repo.SegmentRow) {
  return {
    id: row.id,
    name: row.name,
    rules: JSON.parse(row.rulesJson) as SegmentRule[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function requireOwnedContact(db: Db, id: string, orgId: string): Promise<repo.ContactRow> {
  const contact = await repo.findContactForOrg(db, id, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");
  return contact;
}

// DEC-629 amendment (wave 49): set-based twin of requireOwnedContact. Proves
// org ownership of a whole id set in ONE select (inArray + orgId), instead
// of one sequential SELECT per id. Walks `ids` in REQUEST order so the FIRST
// id missing from the org's contacts throws the identical ApiError the
// singular helper throws -- a foreign or unknown id anywhere in the set
// still yields zero writes, same as before.
export async function requireOwnedContacts(db: Db, ids: string[], orgId: string): Promise<Map<string, repo.ContactRow>> {
  const byId = new Map<string, repo.ContactRow>();
  // DEC-078: ids is a client-supplied bulk-op id set (merge candidates), not
  // a bounded enum -- chunk it so a large merge selection never exceeds the
  // D1 bound-parameter ceiling.
  for (const batch of chunkIds(ids)) {
    const rows = await db
      .select()
      .from(schema.contact)
      .where(and(inArray(schema.contact.id, batch), eq(schema.contact.orgId, orgId)));
    for (const row of rows) {
      const contact = repo.toRow(row);
      byId.set(contact.id, contact);
    }
  }
  for (const id of ids) {
    if (!byId.has(id)) throw new ApiError("not_found", "Contact not found");
  }
  return byId;
}

export async function requireOwnedSegment(db: Db, id: string, orgId: string): Promise<repo.SegmentRow> {
  const segment = await repo.findSegmentForOrg(db, id, orgId);
  if (!segment) throw new ApiError("not_found", "Segment not found");
  return segment;
}
