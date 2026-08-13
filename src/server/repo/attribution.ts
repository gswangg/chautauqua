// DEC-299: a NULL participant attribution snapshot (title_at_time/
// org_at_time) is not "frozen" the way a real snapshot is — DEC-258 froze
// contact.title/company into participant.title_at_time/org_at_time at
// participant-creation time, but public submitters never had a title/company
// to freeze (the default CFP form collects neither), so their snapshot rows
// are permanently NULL even after they later fill in their portal profile or
// an organizer edits their contact record. This module REPAIRS that gap: it
// backfills any still-NULL snapshot column the first time the underlying
// contact.title/company is written with a real value. It does NOT change
// DEC-258's read rule — public/export/ics reads still read
// participant.title_at_time/org_at_time with no live-contact fallback; this
// only ever changes what gets written into that column, and only when the
// column was NULL to begin with. A once-set (non-null) snapshot is never
// overwritten here.

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";

export interface AttributionUpdate {
  title: string | null;
  company: string | null;
}

/** Backfills participant.title_at_time/org_at_time for every participant row
 * belonging to `contactId` whose snapshot column is currently NULL, using
 * `next.title`/`next.company` — but only for the columns where the caller
 * supplied a non-empty (post-trim) value. Blank/whitespace-only/null values
 * are treated as "nothing to backfill" and produce no write. Title and
 * company are independent: either, both, or neither may update, and a
 * contact with no participant rows is a harmless no-op. */
export async function backfillNullAttribution(db: Db, contactId: string, next: AttributionUpdate): Promise<void> {
  const title = typeof next.title === "string" ? next.title.trim() : "";
  const company = typeof next.company === "string" ? next.company.trim() : "";

  if (title.length > 0) {
    await db
      .update(schema.participant)
      .set({ titleAtTime: title, updatedAt: new Date() })
      .where(and(eq(schema.participant.contactId, contactId), isNull(schema.participant.titleAtTime)));
  }

  if (company.length > 0) {
    await db
      .update(schema.participant)
      .set({ orgAtTime: company, updatedAt: new Date() })
      .where(and(eq(schema.participant.contactId, contactId), isNull(schema.participant.orgAtTime)));
  }
}

/** DEC-491 amendment (wave 47): the set-based twin of backfillNullAttribution
 * above, for a batch of contacts (the CSV import commit flush). Identical
 * NULL-only semantics per contact/column — only the wiring differs: instead
 * of one UPDATE per contact, this groups contacts by their DISTINCT
 * non-blank title value and DISTINCT non-blank company value and issues one
 * chunked (ID_CHUNK_SIZE, DEC-078) `WHERE contact_id IN (...) AND
 * title_at_time IS NULL` UPDATE per distinct value — so N contacts sharing
 * the same title/company (the common CSV-import case: a whole roster from
 * one company) collapse onto far fewer statements than N. A contact with a
 * blank/whitespace-only/undefined title or company is simply never grouped
 * into any bucket for that column (same "nothing to backfill" rule as the
 * single-contact function). backfillNullAttribution above is unchanged and
 * stays for its other (non-import) callers. */
export async function backfillNullAttributionMany(
  db: Db,
  updates: { contactId: string; title: string | null; company: string | null }[],
): Promise<void> {
  const byTitle = new Map<string, string[]>();
  const byCompany = new Map<string, string[]>();
  for (const u of updates) {
    const title = typeof u.title === "string" ? u.title.trim() : "";
    const company = typeof u.company === "string" ? u.company.trim() : "";
    if (title.length > 0) {
      const ids = byTitle.get(title) ?? [];
      ids.push(u.contactId);
      byTitle.set(title, ids);
    }
    if (company.length > 0) {
      const ids = byCompany.get(company) ?? [];
      ids.push(u.contactId);
      byCompany.set(company, ids);
    }
  }

  for (const [title, contactIds] of byTitle) {
    for (const batch of chunkIds(contactIds)) {
      await db
        .update(schema.participant)
        .set({ titleAtTime: title, updatedAt: new Date() })
        .where(and(inArray(schema.participant.contactId, batch), isNull(schema.participant.titleAtTime)));
    }
  }

  for (const [company, contactIds] of byCompany) {
    for (const batch of chunkIds(contactIds)) {
      await db
        .update(schema.participant)
        .set({ orgAtTime: company, updatedAt: new Date() })
        .where(and(inArray(schema.participant.contactId, batch), isNull(schema.participant.orgAtTime)));
    }
  }
}
