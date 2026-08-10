// DEC-100: atomic seq allocation for new submission rows. Rather than a
// SELECT-then-INSERT (a UNIQUE-violation race under concurrent submits to
// the same event), this fragment is passed straight into the `seq` column
// of the single INSERT statement — atomic under SQLite/D1's single-writer
// model.

import { type SQL, eq, sql } from "drizzle-orm";
import * as schema from "../../../db/schema";

/** `(SELECT COALESCE(MAX(seq), 0) + 1 FROM submission WHERE event_id = <eventId>)`,
 * built from schema-derived identifiers so the SQL stays in sync with the
 * table/column definitions. */
export function submissionSeqSubquery(eventId: string): SQL<number> {
  const eventIdMatch = eq(schema.submission.eventId, eventId);
  return sql<number>`(SELECT COALESCE(MAX(${schema.submission.seq}), 0) + 1 FROM ${schema.submission} WHERE ${eventIdMatch})`;
}
