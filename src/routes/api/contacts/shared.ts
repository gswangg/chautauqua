// Shared helpers for the CRM API (J11) submodules under this directory —
// split out of the former monolithic src/routes/api/contacts.ts for
// contention (803-line hotspot) reasons only; no behavior change.

import { ApiError } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import type { Db } from "../../../server/context";
import type { SegmentRule } from "../../../domain/contacts";

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

// DEC-417
export function checkLen(value: string, field: string, max: number, fields: Record<string, string>): void {
  if (value.length > max) fields[field] = `Max ${max}`;
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
    customFields: row.customFieldsJson ? JSON.parse(row.customFieldsJson) : null,
    socialLinks: row.socialLinksJson ? JSON.parse(row.socialLinksJson) : null,
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

export async function requireOwnedSegment(db: Db, id: string, orgId: string): Promise<repo.SegmentRow> {
  const segment = await repo.findSegmentForOrg(db, id, orgId);
  if (!segment) throw new ApiError("not_found", "Segment not found");
  return segment;
}
