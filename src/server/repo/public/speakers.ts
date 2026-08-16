// Public/embed repo layer (J10, DEC-022, DEC-274): speakers directory /
// gallery surface.

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { DEC_258, DEC_418 } from "../../../decisions";
import { chunkIds } from "../../../lib/chunk";
import { visibleSubmissionConditions } from "./gates";
import type { PublicSpeaker } from "./sessions";
import { boundedRowLimit, boundedWindow } from "./bounds";
import { likeContains } from "../like";

// Compile-checked dependency marker (DEC-258, wave-75 amendment): this
// module renders a PERSON (the speakers list / gallery row), never a
// PARTICIPATION, so title/company below come from the live contact record,
// never participant.title_at_time/org_at_time — no fallback either way.
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
 * DEC-258 wave-75 amendment: the frozen-snapshot rule is PERSON-vs-
 * PARTICIPATION, stated as a predicate, not a list of pages. A surface whose
 * unit of rendering is a PERSON (this list, the gallery it feeds, and the
 * speaker detail header in detail.ts) reads `contact.title`/`contact.company`
 * — deterministic, null when the CRM has none, never borrowed from a talk. A
 * surface whose unit of rendering is a PARTICIPATION (session cards in
 * sessions.ts, agenda blocks, the .ics speaker line, the CSV/JSON exports)
 * keeps `participant.titleAtTime`/`orgAtTime` unchanged.
 *
 * DEC-418 part 2: two-step so the page bound is never applied to the
 * fanned-out (one row per speaker x session) hydration rows. Step 1 selects
 * distinct contact ids (+ a count) under the visibility gate, bounded to
 * `page * perPage`. Step 2 hydrates only those ids with the full joined
 * session list, unbounded, preserving step-1's id order. */
export async function getPublicSpeakers(
  db: Db,
  eventId: string,
  opts: { q?: string | null; trackId?: string | null; page: number; perPage: number; window?: boolean },
): Promise<PublicSpeakersPage> {
  const conditions = [eq(schema.submission.eventId, eventId), visibleSubmissionConditions()];
  const q = opts.q?.trim();
  // DEC-990 amendment (wave 64): the ONE track facet, enforced in SQL as an
  // EXISTS over submission_track scoped to the same submission this
  // speaker's participant row joins to — applied to BOTH the distinct-id
  // query and the count below (never one and not the other, or the pager
  // and the total disagree).
  const trackId = opts.trackId?.trim() || null;
  if (trackId) {
    conditions.push(
      sql`exists (select 1 from ${schema.submissionTrack} where ${schema.submissionTrack.submissionId} = ${schema.submission.id} and ${schema.submissionTrack.trackId} = ${trackId})`,
    );
  }
  if (q) {
    // DEC-506: escape via likeContains + pair with ESCAPE '\\' so a
    // literal `%`/`_` in the query string can't widen into a wildcard
    // match (unescaped LIKE previously let `?q=%` return the whole
    // roster).
    const like = likeContains(q);
    conditions.push(
      or(
        sql`${schema.contact.firstName} LIKE ${like} ESCAPE '\\'`,
        sql`${schema.contact.lastName} LIKE ${like} ESCAPE '\\'`,
        sql`(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) LIKE ${like} ESCAPE '\\'`,
      )!,
    );
  }

  // DEC-516: `window` opts into a real one-page LIMIT+OFFSET (boundedWindow)
  // for the paged JSON feeds; defaults to false so the HTML directory/
  // gallery show-more list keeps getting boundedRowLimit's cumulative
  // prefix. offset() is only chained when non-zero so page 1 stays the
  // identical query shape either way (existing fake-db-chain harnesses stub
  // .limit() as the terminal call).
  const { limit, offset } = opts.window
    ? boundedWindow(opts.page, opts.perPage)
    : { limit: boundedRowLimit(opts.page, opts.perPage), offset: 0 };
  const idQuery = db
    .selectDistinct({ contactId: schema.contact.id })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(...conditions))
    // DEC-534: lastName/firstName alone are not unique — two speakers
    // sharing a name would break the J10 directory's paging. contact.id is
    // already the selected column.
    .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName), asc(schema.contact.id))
    .limit(limit);
  const idRows = await (offset > 0 ? idQuery.offset(offset) : idQuery);
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
        // DEC-258 wave-75 amendment: this row renders a PERSON (the
        // directory / gallery), so title/company are the live contact
        // record, not the per-submission frozen snapshot — see the
        // per-session PARTICIPATION reads in sessions.ts:412-413, which
        // stay on participant.titleAtTime/orgAtTime unchanged.
        title: schema.contact.title,
        company: schema.contact.company,
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
