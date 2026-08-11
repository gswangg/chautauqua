// Public/embed repo layer (J10, DEC-022, DEC-274): speakers directory /
// gallery surface.

import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { DEC_258 } from "../../../decisions";
import { visibleSubmissionConditions } from "./gates";
import type { PublicSpeaker } from "./sessions";

// Compile-checked dependency marker: every speaker title/company read below
// comes from participant.title_at_time/org_at_time (DEC-258's frozen
// snapshot), never the live contact — no fallback.
void DEC_258;

export interface PublicSpeakerWithSessions extends PublicSpeaker {
  sessions: Array<{ id: string; title: string }>;
}

/** Speakers surface (DEC-022): alphabetical by surname, each with the list
 * of their visible sessions at this event. Gallery reuses this (headshot
 * grid is a rendering choice, not a different query). `q` (DEC-151) is an
 * optional case-insensitive name-search filter over first/last/full name,
 * applied server-side so both the directory and gallery search forms stay
 * JS-free GETs. */
export async function getPublicSpeakers(
  db: Db,
  eventId: string,
  opts?: { q?: string | null },
): Promise<PublicSpeakerWithSessions[]> {
  const conditions = [eq(schema.submission.eventId, eventId), visibleSubmissionConditions()];
  const q = opts?.q?.trim();
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

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName), asc(schema.submission.title));

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
  // rows are already ordered by lastName/firstName; Map preserves first-seen
  // insertion order, so this reflects that ordering.
  return [...bySpeaker.values()];
}
