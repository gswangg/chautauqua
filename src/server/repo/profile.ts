// Portal profile self-service repo (J7, DEC-028): speakers edit their own
// contact record; the producer's contact row updates in place — same row,
// no shadow/staging copy. Repo functions are the only code that touches
// drizzle row types (DEC-012); scoping is absolute — every write below is
// keyed by the speaker's own contact_id (never a request-supplied id).

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { visibleSubmissionConditions } from "./public";
import { backfillNullAttribution } from "./attribution";
import { touchSubmissionsForContacts } from "./submissions/touch";
import { ACTIVE_INVITE_STATUSES, PROFILE_TASK_TITLE } from "../../domain/acceptance";

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
  const before = await db
    .select({ firstName: schema.contact.firstName, lastName: schema.contact.lastName })
    .from(schema.contact)
    .where(eq(schema.contact.id, contactId))
    .limit(1);
  const now = new Date();
  await db
    .update(schema.contact)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      title: input.title,
      company: input.company,
      bio: input.bio,
      socialLinksJson: serializeSocialLinks(input.socialLinks),
      updatedAt: now,
    })
    .where(eq(schema.contact.id, contactId));
  // DEC-299: repair any never-taken (NULL) attribution snapshot now that the
  // speaker has written a real title/company through their portal profile.
  await backfillNullAttribution(db, contactId, { title: input.title, company: input.company });
  // DEC-725 (wave-32 amendment): the name is what airtable.ts serializes
  // into the Speakers cell — bump dependent submissions only when the name
  // actually changed (a bio/title/headshot-only save is a no-op), mirroring
  // DEC-519's same-string rule.
  const prev = before[0];
  if (prev && (prev.firstName !== input.firstName || prev.lastName !== input.lastName)) {
    await touchSubmissionsForContacts(db, [contactId], now);
  }
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
    // DEC-773 amendment (w29-b): headshotFileId mirrors headshotUrl's
    // fileId for files-library.ts's indexable join -- both always point at
    // the same fileId, set together.
    .set({ headshotUrl: `/headshots/${fileId}`, headshotFileId: fileId, updatedAt: now })
    .where(eq(schema.contact.id, contactId));
  return fileId;
}

/**
 * DEC-009 amendment (wave 59): closes every pending PROFILE_TASK_TITLE
 * ("Finalize bio + headshot") assignment for this contact, across every
 * event of `orgId` where the contact is an ACTIVE_INVITE_STATUSES
 * participant of an accepted submission (mirrors
 * tasks/crud.ts's acceptedSpeakerConditions, scoped by orgId since this repo
 * has no eventId in scope). ONE set-based UPDATE, never a per-row loop or
 * read-then-write — completion is terminal by construction: only rows still
 * `status = 'pending'` are touched, so a later field clear (which never
 * calls this function) cannot reopen an already-closed assignment. Returns
 * the number of assignment rows closed.
 */
export async function completeProfileTaskForContact(
  db: Db,
  contactId: string,
  orgId: string,
  completedByUserId: string | null,
): Promise<number> {
  const now = new Date();
  const activeStatuses = sql.join(
    ACTIVE_INVITE_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  );
  const rows = await db
    .update(schema.taskAssignment)
    .set({ status: "complete", completedAt: now, completedBy: completedByUserId, updatedAt: now })
    .where(
      and(
        eq(schema.taskAssignment.contactId, contactId),
        eq(schema.taskAssignment.status, "pending"),
        sql`${schema.taskAssignment.taskId} in (
          select ${schema.task.id} from ${schema.task}
          inner join ${schema.event} on ${schema.event.id} = ${schema.task.eventId}
          where ${schema.task.title} = ${PROFILE_TASK_TITLE}
            and ${schema.event.orgId} = ${orgId}
            and ${schema.event.id} in (
              select ${schema.submission.eventId} from ${schema.participant}
              inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId}
              where ${schema.participant.contactId} = ${contactId}
                and ${schema.submission.status} = 'accepted'
                and ${schema.participant.inviteStatus} in (${activeStatuses})
            )
        )`,
      ),
    )
    .returning({ id: schema.taskAssignment.id });
  return rows.length;
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
  const [fileRows, contactRows] = await Promise.all([
    db
      .select({ kind: schema.file.kind, r2Key: schema.file.r2Key, contentType: schema.file.contentType })
      .from(schema.file)
      .where(eq(schema.file.id, fileId))
      .limit(1),
    // DEC-773 amendment (w32-e): indexed lookup via contact_headshot_file_id_idx
    // instead of an unindexed headshotUrl string scan -- headshotFileId is
    // written together with headshotUrl at every writer (setContactHeadshot,
    // contacts/merge.ts, scripts/seed.ts), so this stays semantically
    // identical: a superseded upload still 404s.
    db
      .select({ id: schema.contact.id, orgId: schema.contact.orgId })
      .from(schema.contact)
      .where(eq(schema.contact.headshotFileId, fileId))
      .limit(1),
  ]);
  const fileRow = fileRows[0];
  if (!fileRow || fileRow.kind !== "headshot") return null;

  const contactRow = contactRows[0];
  if (!contactRow) return null;

  // DEC-558 (wave 75, amended wave 5): only `.length > 0` is read below --
  // WHICH visible participant row SQLite returns is never observed, so row
  // identity doesn't matter. .orderBy(...) is added anyway so the pick is
  // reproducible rather than merely harmless.
  const visibleRows = await db
    .select({ id: schema.participant.id })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.participant.contactId, contactRow.id), visibleSubmissionConditions()))
    .orderBy(asc(schema.participant.id))
    .limit(1);

  return {
    r2Key: fileRow.r2Key,
    contentType: fileRow.contentType,
    contactId: contactRow.id,
    orgId: contactRow.orgId,
    publiclyVisible: visibleRows.length > 0,
  };
}
