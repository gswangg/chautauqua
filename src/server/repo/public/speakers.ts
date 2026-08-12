// Public/embed repo layer (J10, DEC-022, DEC-274): speakers directory /
// gallery surface.

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { DEC_258, DEC_418 } from "../../../decisions";
import { chunkIds } from "../../../lib/chunk";
import { visibleSubmissionConditions } from "./gates";
import type { PublicSpeaker } from "./sessions";
import { boundedRowLimit } from "./bounds";

// Compile-checked dependency marker: every speaker title/company read below
// comes from participant.title_at_time/org_at_time (DEC-258's frozen
// snapshot), never the live contact — no fallback.
void DEC_258;
// DEC-418 part 2: the page bound is applied to the distinct-contact id
// query, NEVER to the fanned-out (speaker x session) hydration rows — a
// speaker with many sessions must never be truncated mid-session-list.
void DEC_418;

export interface PublicSpeakerWithSessions extends PublicSpeaker {
  sessions: Array<{ id: string; title: string }>;
}

export interface PublicSpeakersPage {
  items: PublicSpeakerWithSessions[];
  total: number;
}

/** Speakers surface (DEC-022): alphabetical by surname, each with the list
 * of their visible sessions at this event. Gallery reuses this (headshot
 * grid is a rendering choice, not a different query). `q` (DEC-151) is an
 * optional case-insensitive name-search filter over first/last/full name,
 * applied server-side so both the directory and gallery search forms stay
 * JS-free GETs.
 *
 * DEC-418 part 2: two-step so the page bound is never applied to the
 * fanned-out (one row per speaker x session) hydration rows. Step 1 selects
 * distinct contact ids (+ a count) under the visibility gate, bounded to
 * `page * perPage`. Step 2 hydrates only those ids with the full joined
 * session list, unbounded, preserving step-1's id order. */
export async function getPublicSpeakers(
  db: Db,
  eventId: string,
  opts: { q?: string | null; page: number; perPage: number },
): Promise<PublicSpeakersPage> {
  const conditions = [eq(schema.submission.eventId, eventId), visibleSubmissionConditions()];
  const q = opts.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        sql`${schema.contact.firstName} LIKE ${pattern} COLLATE NOCASE`,
        sql`${schema.contact.lastName} LIKE ${pattern} COLLATE NOCASE`,
        sql`(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) LIKE ${pattern} COLLATE NOCASE`,
      )!,
    );
  }

  const idRows = await db
    .selectDistinct({ contactId: schema.contact.id })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(...conditions))
    .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName))
    .limit(boundedRowLimit(opts.page, opts.perPage));
  const orderedIds = idRows.map((r) => r.contactId);

  const countRows = await db
    .select({ total: sql<number>`count(distinct ${schema.contact.id})` })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(...conditions));
  const total = countRows[0]?.total ?? 0;

  if (orderedIds.length === 0) return { items: [], total: Number(total) };

  const rows: {
    contactId: string;
    firstName: string;
    lastName: string;
    title: string | null;
    company: string | null;
    headshotUrl: string | null;
    bio: string | null;
    submissionId: string;
    submissionTitle: string;
  }[] = [];
  for (const batch of chunkIds(orderedIds)) {
    const batchRows = await db
      .select({
        contactId: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        title: schema.participant.titleAtTime,
        company: schema.participant.orgAtTime,
        headshotUrl: schema.contact.headshotUrl,
        bio: schema.contact.bio,
        submissionId: schema.submission.id,
        submissionTitle: schema.submission.title,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .where(and(...conditions, inArray(schema.contact.id, batch)))
      .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName), asc(schema.submission.title));
    rows.push(...batchRows);
  }

  const bySpeaker = new Map<string, PublicSpeakerWithSessions>();
  for (const row of rows) {
    let speaker = bySpeaker.get(row.contactId);
    if (!speaker) {
      speaker = {
        contactId: row.contactId,
        firstName: row.firstName,
        lastName: row.lastName,
        title: row.title,
        company: row.company,
        headshotUrl: row.headshotUrl,
        bio: row.bio,
        sessions: [],
      };
      bySpeaker.set(row.contactId, speaker);
    }
    speaker.sessions.push({ id: row.submissionId, title: row.submissionTitle });
  }

  const items = orderedIds
    .map((id) => bySpeaker.get(id))
    .filter((s): s is PublicSpeakerWithSessions => s !== undefined);

  return { items, total: Number(total) };
}
