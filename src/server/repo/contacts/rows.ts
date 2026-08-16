// Contacts repo: row shapes + drizzle-row <-> domain mapping. Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import * as schema from "../../../db/schema";
import type { ContactRecord } from "../../../domain/contacts";
import { parseSocialLinks } from "../profile";
import { parseContactCustomFields } from "./crud";

// DEC-554: the ONE shared bound for both whole-directory contact scans —
// duplicate detection (contacts/merge.ts) and the segment/rules list path
// (contacts/crud.ts). Each scans with `.limit(MAX_CONTACT_DIRECTORY_SCAN + 1)`
// over `order by id asc` and refuses (throws) rather than silently truncating
// once an org's contact count exceeds this.
export const MAX_CONTACT_DIRECTORY_SCAN = 20000;

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

export function toRow(r: typeof schema.contact.$inferSelect): ContactRow {
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
    customFields: parseContactCustomFields(row.customFieldsJson),
  };
}
