// Home hub repo layer (DEC-581): fetches candidate rows for GET / and
// applies nothing but org scope + a bounded window. Grouping/visibility is
// owned entirely by src/lib/home-hub.ts's groupHubEvents() — this module
// never filters or groups, it only binds primitives and hands back
// {items, capped} (DEC-670: never an org-wide count -- GET / is anonymous).
// publishedSessionCount reuses visibleSessionConditions()
// (src/server/repo/public/gates.ts), the SAME predicate the public sessions
// list uses, so "published" never gets redefined a second way here.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formWindowState } from "../../../lib/submit-core";
import { isHubVisible, type HubEvent } from "../../../lib/home-hub";
import { visibleSessionConditions } from "./gates";
import { answerFieldRoleCondition } from "../form-roles";

/** DEC-522: event.start_date/end_date are DAY LABELS ('YYYY-MM-DD'), not
 * instants — parsed here as UTC midnight of that calendar day, the same
 * epoch-ms convention every other day-label field in this codebase uses
 * (form.open_date/close_date). Never toISOString. */
function parseDayLabelMs(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) {
    throw new Error(`Invalid day label '${day}' — expected 'YYYY-MM-DD'`);
  }
  return Date.UTC(year, month - 1, date);
}

/** The deployment's single org (STAGE 1 is single-tenant), ordered by id
 * asc so a multi-row test fixture still resolves deterministically. */
export async function getHubOrg(db: Db): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: schema.org.id, name: schema.org.name })
    .from(schema.org)
    .orderBy(asc(schema.org.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Hard cap on the number of candidate rows fetched for the home hub —
 * exported so callers (and their "capped" note) never hand-copy this
 * number. */
export const HUB_CANDIDATE_LIMIT = 100;

export interface HubEventsPage {
  items: HubEvent[];
  /** True when the candidate window returned exactly HUB_CANDIDATE_LIMIT
   * rows — i.e. there may be more events in the org than were fetched. This
   * is NEVER an org-wide count: GET / is an anonymous surface and a
   * count(*) over every event (including ones the hub deliberately hides)
   * would disclose organizer-only information to a stranger. */
  capped: boolean;
}

/** Candidate rows for the home hub (DEC-581): every event in the org,
 * joined to its default form for the CFP open/close window, LIMIT
 * HUB_CANDIDATE_LIMIT ordered by start_date desc/id asc. Does NOT filter by
 * cfpOpen/publishedSessionCount — that predicate lives in groupHubEvents(),
 * not here. */
export async function listHubEvents(db: Db, orgId: string, nowMs: number): Promise<HubEventsPage> {
  const rows = await db
    .select({
      id: schema.event.id,
      name: schema.event.name,
      slug: schema.event.slug,
      startDate: schema.event.startDate,
      endDate: schema.event.endDate,
      location: schema.event.location,
      timezone: schema.event.timezone,
      openDate: schema.form.openDate,
      closeDate: schema.form.closeDate,
    })
    .from(schema.event)
    .leftJoin(schema.form, and(eq(schema.form.eventId, schema.event.id), eq(schema.form.isDefault, true)))
    .where(eq(schema.event.orgId, orgId))
    .orderBy(desc(schema.event.startDate), asc(schema.event.id))
    .limit(HUB_CANDIDATE_LIMIT);

  const eventIds = rows.map((r) => r.id);
  const countRows =
    eventIds.length === 0
      ? []
      : await db
          .select({ eventId: schema.submission.eventId, count: sql<number>`count(distinct ${schema.submission.id})` })
          .from(schema.submission)
          .where(and(inArray(schema.submission.eventId, eventIds), visibleSessionConditions()))
          .groupBy(schema.submission.eventId);
  const publishedCountByEventId = new Map(countRows.map((r) => [r.eventId, Number(r.count)]));

  // DEC-581 amendment (w69-a): cfpOpen and publishedSessionCount must be
  // known BEFORE the shape-count queries below, so those queries can be
  // scoped to only the ids isHubVisible() actually lets a stranger see —
  // the same predicate groupHubEvents() applies, computed once here.
  const cfpOpenByEventId = new Map(
    rows.map((row) => {
      const openDate = row.openDate ? row.openDate.getTime() : null;
      const closeDate = row.closeDate ? row.closeDate.getTime() : null;
      return [row.id, formWindowState(openDate, closeDate, nowMs, row.timezone) === "open"] as const;
    }),
  );
  const visibleEventIds = eventIds.filter((id) =>
    isHubVisible({
      cfpOpen: cfpOpenByEventId.get(id) ?? false,
      publishedSessionCount: publishedCountByEventId.get(id) ?? 0,
    }),
  );

  // DEC-943: two grouped queries over the visible-only eventIds -- never a
  // query per event (DEC-078), and never issued at all when nothing is
  // visible. Both compose the same visibleSessionConditions() predicate the
  // published-session count above uses, so "shape" counts only ever reflect
  // publicly visible sessions.
  const trackCountRows =
    visibleEventIds.length === 0
      ? []
      : await db
          .select({
            eventId: schema.submission.eventId,
            count: sql<number>`count(distinct ${schema.submissionTrack.trackId})`,
          })
          .from(schema.submissionTrack)
          .innerJoin(schema.submission, eq(schema.submissionTrack.submissionId, schema.submission.id))
          .where(and(inArray(schema.submission.eventId, visibleEventIds), visibleSessionConditions()))
          .groupBy(schema.submission.eventId);
  const trackCountByEventId = new Map(trackCountRows.map((r) => [r.eventId, Number(r.count)]));

  // DEC-592 (Amendment, wave 80): count only the value_json shapes
  // src/server/repo/form-roles.ts's roleAnswerLabel() maps to a non-null
  // label -- a stored JSON string that is not "" (every other value_json
  // shape -- '""', 'null', a number, an array, an object -- is a
  // non-answer there and must not inflate this count). A role answer's
  // value_json is single-select-dropdown text, never containing an
  // embedded, unescaped '"', so "starts and ends with a quote, and isn't
  // exactly the empty-string literal" exactly mirrors roleAnswerLabel's
  // JS-side check without pulling every row back to run it in JS.
  const formatCountRows =
    visibleEventIds.length === 0
      ? []
      : await db
          .select({
            eventId: schema.submission.eventId,
            count: sql<number>`count(distinct ${schema.submissionAnswer.valueJson})`,
          })
          .from(schema.submissionAnswer)
          .innerJoin(schema.submission, eq(schema.submissionAnswer.submissionId, schema.submission.id))
          .where(
            and(
              inArray(schema.submission.eventId, visibleEventIds),
              answerFieldRoleCondition("session_format"),
              visibleSessionConditions(),
              // DEC-506/DEC-511: every hand-written LIKE in the repo layer
              // pairs the keyword with ESCAPE '\\'. The pattern here is a
              // fixed literal containing no backslash, so naming `\` the
              // escape character leaves the predicate's meaning untouched
              // (the `%` stays a wildcard -- only `\%` would be literal);
              // it keeps this template inside the ONE sanctioned idiom.
              sql`${schema.submissionAnswer.valueJson} LIKE '"%"' ESCAPE '\\' AND ${schema.submissionAnswer.valueJson} != '""'`,
            ),
          )
          .groupBy(schema.submission.eventId);
  const formatCountByEventId = new Map(formatCountRows.map((r) => [r.eventId, Number(r.count)]));

  const items: HubEvent[] = rows.map((row) => {
    const closeDate = row.closeDate ? row.closeDate.getTime() : null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      startDate: parseDayLabelMs(row.startDate),
      endDate: parseDayLabelMs(row.endDate),
      location: row.location,
      timezone: row.timezone,
      cfpCloseDate: closeDate,
      cfpOpen: cfpOpenByEventId.get(row.id) ?? false,
      publishedSessionCount: publishedCountByEventId.get(row.id) ?? 0,
      trackCount: trackCountByEventId.get(row.id) ?? 0,
      formatCount: formatCountByEventId.get(row.id) ?? 0,
    };
  });

  return { items, capped: rows.length === HUB_CANDIDATE_LIMIT };
}
