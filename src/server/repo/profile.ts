// Portal profile self-service repo (J7, DEC-028): speakers edit their own
// contact record; the producer's contact row updates in place — same row,
// no shadow/staging copy. Repo functions are the only code that touches
// drizzle row types (DEC-012); scoping is absolute — every write below is
// keyed by the speaker's own contact_id (never a request-supplied id).

import { and, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { visibleSubmissionConditions } from "./public";
import { backfillNullAttribution } from "./attribution";

// ---------------------------------------------------------------------------
// Pure helpers (no db/IO) — unit-tested directly.
// ---------------------------------------------------------------------------

export interface SocialLinks {
  twitter: string;
  linkedin: string;
  github: string;
  website: string;
}

const EMPTY_SOCIAL_LINKS: SocialLinks = { twitter: "", linkedin: "", github: "", website: "" };

/** Parses contact.social_links_json into a SocialLinks record; a null/empty
 * column, malformed JSON, or a non-object value all fall back to the empty
 * record (a speaker who's never filled this in has no links, not corrupt
 * data) — each individual key is still coerced to a string, dropping any
 * unexpected extra keys. */
export function parseSocialLinks(json: string | null): SocialLinks {
  if (!json) return { ...EMPTY_SOCIAL_LINKS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ...EMPTY_SOCIAL_LINKS };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ...EMPTY_SOCIAL_LINKS };
  }
  const obj = parsed as Record<string, unknown>;
  return {
    twitter: typeof obj.twitter === "string" ? obj.twitter : "",
    linkedin: typeof obj.linkedin === "string" ? obj.linkedin : "",
    github: typeof obj.github === "string" ? obj.github : "",
    website: typeof obj.website === "string" ? obj.website : "",
  };
}

/** Serializes a SocialLinks record to JSON for contact.social_links_json,
 * trimming each field and dropping empties from the stored object (so an
 * all-blank form doesn't persist noise) — round-trips through
 * parseSocialLinks back to '' for any dropped key. */
export function serializeSocialLinks(links: SocialLinks): string {
  const out: Partial<SocialLinks> = {};
  for (const key of Object.keys(links) as (keyof SocialLinks)[]) {
    const value = links[key].trim();
    if (value.length > 0) out[key] = value;
  }
  return JSON.stringify(out);
}

// ---------------------------------------------------------------------------
// Query-backed reads/writes
// ---------------------------------------------------------------------------

export interface ContactProfile {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  headshotUrl: string | null;
  socialLinks: SocialLinks;
}

/** Loads exactly one speaker's own profile row — the caller must have
 * already resolved contactId from the verified session (assertSpeakerContactId),
 * never from a request param. */
export async function getContactProfile(db: Db, contactId: string): Promise<ContactProfile | null> {
  const rows = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      title: schema.contact.title,
      company: schema.contact.company,
      bio: schema.contact.bio,
      headshotUrl: schema.contact.headshotUrl,
      socialLinksJson: schema.contact.socialLinksJson,
    })
    .from(schema.contact)
    .where(eq(schema.contact.id, contactId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    title: row.title,
    company: row.company,
    bio: row.bio,
    headshotUrl: row.headshotUrl,
    socialLinks: parseSocialLinks(row.socialLinksJson),
  };
}

export interface ProfileUpdateInput {
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  socialLinks: SocialLinks;
}

/** Updates the speaker's own contact row in place — same row the producer
 * sees, so the change is instant, no separate staging table (J7). */
export async function updateContactProfile(db: Db, contactId: string, input: ProfileUpdateInput): Promise<void> {
  await db
    .update(schema.contact)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      title: input.title,
      company: input.company,
      bio: input.bio,
      socialLinksJson: serializeSocialLinks(input.socialLinks),
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, contactId));
  // DEC-299: repair any never-taken (NULL) attribution snapshot now that the
  // speaker has written a real title/company through their portal profile.
  await backfillNullAttribution(db, contactId, { title: input.title, company: input.company });
}

export interface InsertHeadshotFileInput {
  filename: string;
  r2Key: string;
  sizeBytes: number;
  contentType: string;
  uploadedByContactId: string;
}

/** Inserts the headshot's file row (kind 'headshot', submission_id null per
 * DEC-028) and points contact.headshot_url at the public serving route —
 * both writes are scoped to the same contactId, keyed off the verified
 * session, never a request param. */
export async function setContactHeadshot(db: Db, contactId: string, input: InsertHeadshotFileInput): Promise<string> {
  const fileId = newId();
  const now = new Date();
  await db.insert(schema.file).values({
    id: fileId,
    submissionId: null,
    kind: "headshot",
    filename: input.filename,
    r2Key: input.r2Key,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    previousFileId: null,
    uploadedByContactId: input.uploadedByContactId,
    createdAt: now,
    updatedAt: now,
  });
  await db
    .update(schema.contact)
    .set({ headshotUrl: `/headshots/${fileId}`, updatedAt: now })
    .where(eq(schema.contact.id, contactId));
  return fileId;
}

export interface HeadshotServeScope {
  r2Key: string;
  contentType: string;
  contactId: string;
  orgId: string;
  // Mirrors repo/public.ts's exact visibility predicate (DEC-067): a
  // participant row with visible=1 on >=1 submission with
  // status='accepted' AND content_status='approved' for this contact.
  publiclyVisible: boolean;
}

/** Loads scope for the public/gated GET /headshots/:fileId route (DEC-067,
 * supersedes the old getHeadshotFileScope). Returns null unless: the file
 * row exists AND kind is exactly 'headshot' (never serve a submission
 * deliverable through this route) AND some contact row's headshotUrl
 * points back at this exact fileId — a reverse lookup, so a superseded
 * upload (contact re-uploaded, headshotUrl now points elsewhere) 404s even
 * though the old file row and its R2 object still exist. publiclyVisible
 * reuses repo/public.ts's visibleSubmissionConditions() verbatim so the
 * gate can never drift from the public speakers/sessions surfaces. */
export async function getHeadshotServeScope(db: Db, fileId: string): Promise<HeadshotServeScope | null> {
  const fileRows = await db
    .select({ kind: schema.file.kind, r2Key: schema.file.r2Key, contentType: schema.file.contentType })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow || fileRow.kind !== "headshot") return null;

  const headshotUrl = `/headshots/${fileId}`;
  const contactRows = await db
    .select({ id: schema.contact.id, orgId: schema.contact.orgId })
    .from(schema.contact)
    .where(eq(schema.contact.headshotUrl, headshotUrl))
    .limit(1);
  const contactRow = contactRows[0];
  if (!contactRow) return null;

  const visibleRows = await db
    .select({ id: schema.participant.id })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.participant.contactId, contactRow.id), visibleSubmissionConditions()))
    .limit(1);

  return {
    r2Key: fileRow.r2Key,
    contentType: fileRow.contentType,
    contactId: contactRow.id,
    orgId: contactRow.orgId,
    publiclyVisible: visibleRows.length > 0,
  };
}
