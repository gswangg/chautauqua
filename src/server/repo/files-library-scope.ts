// Files repo — files library scope/limits. Split out of files-library.ts
// (contention decomposition) — files-library.ts re-exports everything
// below for existing callers.
import { eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";

// DEC-773 (supersedes DEC-669): a headshot file's kind, used both as the
// row's `kind` value and as the extra token the ?kind= filter accepts
// alongside the deliverable kinds.
export const HEADSHOT_KIND = "headshot";

// DEC-773 amendment (w55-c): the ceiling both listEventDeliverableFiles root
// scans (deliverable chain roots, headshot roots) refuse past — mirrors
// contacts/rows.ts's MAX_CONTACT_DIRECTORY_SCAN. Each root query
// `.limit(MAX_FILE_LIBRARY_SCAN + 1)`s and throws rather than silently
// truncating an audit list once an event's matching file count exceeds this.
export const MAX_FILE_LIBRARY_SCAN = 20000;

export interface EventFilesScope {
  orgId: string;
  slug: string;
}

/** Org + slug for the GET/POST /events/:eventId/files* endpoints — slug
 * feeds the ZIP download's Content-Disposition filename. */
export async function getEventFilesScope(db: Db, eventId: string): Promise<EventFilesScope | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId, slug: schema.event.slug })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}
