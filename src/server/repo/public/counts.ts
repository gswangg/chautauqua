// Public/embed repo layer (J10, DEC-767): the settings "Public pages and
// embeds" panel previously derived every row's count from the accepted-
// submission total (SETTINGS PUBLIC-PAGES COUNTS TELL THE TRUTH) — a
// session that is accepted but still content-pending, or whose only
// participant is not publicly visible, was counted for surfaces (Speakers,
// Gallery) that would never actually show it. getPublicSurfaceCounts()
// composes the SAME predicates the SSR public surfaces use
// (visibleSessionConditions/visibleSubmissionConditions from ./gates) so
// the organizer-only settings count and the public page it describes can
// never drift. Three count(*) queries, no row materialisation (DEC-418).

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { visibleSessionConditions, visibleSubmissionConditions, slotWithinEventRange } from "./gates";

export interface PublicSurfaceCounts {
  sessions: number;
  speakers: number;
  scheduled: number;
}

/** Sessions/Agenda/Schedule/Speakers/Gallery counts for the settings public-
 * pages panel (DEC-767). `sessions` is every visibility-gated session
 * (visibleSessionConditions — no participant reference, so a speakerless or
 * all-hidden-speaker session still counts, matching the public sessions
 * list). `speakers` is the distinct publicly-visible contact count
 * (visibleSubmissionConditions, the AND of the session gate and the
 * participant gate — mirrors getPublicSpeakers). `scheduled` is the session
 * count further restricted to rows carrying an in-window schedule_slot
 * (slotWithinEventRange, DEC-318 — the same rule hydrateSessions applies),
 * matching the public schedule surface. */
export async function getPublicSurfaceCounts(db: Db, eventId: string): Promise<PublicSurfaceCounts> {
  const eventRows = await db
    .select({ startDate: schema.event.startDate, endDate: schema.event.endDate })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) throw new Error(`getPublicSurfaceCounts: event ${eventId} not found`);

  const sessionConditions = and(eq(schema.submission.eventId, eventId), visibleSessionConditions());

  const [sessionRows, scheduledRows, speakerRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(schema.submission).where(sessionConditions),
    db
      .select({ count: sql<number>`count(distinct ${schema.submission.id})` })
      .from(schema.submission)
      .innerJoin(
        schema.scheduleSlot,
        and(eq(schema.scheduleSlot.submissionId, schema.submission.id), slotWithinEventRange(event)),
      )
      .where(sessionConditions),
    db
      .select({ count: sql<number>`count(distinct ${schema.contact.id})` })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .where(and(eq(schema.submission.eventId, eventId), visibleSubmissionConditions())),
  ]);

  return {
    sessions: Number(sessionRows[0]?.count ?? 0),
    scheduled: Number(scheduledRows[0]?.count ?? 0),
    speakers: Number(speakerRows[0]?.count ?? 0),
  };
}
