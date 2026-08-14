// DEC-725 amendment (wave 63, extended wave 30): a submission's `updated_at`
// must cover every table its PUBLISHED shape is composed from, not just the
// submission row itself — and, as of this extension, not just row-level
// composition (participant / submission_track) but also the DENORMALISED
// strings src/sync/airtable.ts builds from contact.firstName/lastName and
// track.name. src/sync/airtable.ts:303-304 pushes contact and track names
// into the Speakers/Tracks cells; renaming a contact or a track changes what
// those cells should say without touching participant/submission_track at
// all, so a rename-only writer must ALSO stamp every dependent submission.
//
// Historically, writers of participant/submission_track tables bumped only
// their own row's updatedAt (or nothing at all, for submission_track — it
// has no updatedAt column) and never touched the submission row. Consequence:
// under DEC-725's incremental watermark (`gt(schema.submission.updatedAt,
// mark)`), a change that is entirely contained in participant/
// submission_track — most dangerously, declining a co-presenter, which
// DEC-981 requires to drop that name from the pushed Speakers cell — never
// re-selects the submission on the next tick, so the stale (wrong) Speakers
// string stays live in the customer's Airtable base indefinitely. The same
// staleness now applies to contact/track RENAMES, hence
// touchSubmissionsForContacts/touchSubmissionsForTracks below.
//
// This is deliberately a touch-ON-WRITE shape (every writer of participant /
// submission_track calls touchSubmissions for the submission id or ids it
// just changed) and NOT a change to airtable.ts's predicate. An EXISTS-over-
// dependents predicate (e.g. "OR EXISTS (SELECT 1 FROM participant WHERE
// participant.submission_id = submission.id AND participant.updated_at >
// mark)") looks equivalent but is not: it cannot see a DELETE, because after
// a participant row is gone there is nothing left with an updated_at to
// compare against the watermark. Removing a participant would then silently
// stop re-publishing the submission that lost them. touchSubmissions must be
// called BEFORE (or as part of the same logical operation as) any delete of
// a row this stamp is supposed to represent, while the affected submission
// id is still derivable.
//
// Readers that depend on this stamp — anyone adding a new participant /
// submission_track writer owes both of these an up-to-date updated_at:
//   - src/sync/airtable.ts's DEC-725 watermark (`gt(submission.updatedAt, mark)`)
//   - src/server/repo/overview.ts's producer awaiting-approval worklist,
//     which orders by `desc(submission.updatedAt)` so a session whose
//     speaker list just changed moves back to the top.
//
// DEC-725 amendment (wave 32): the same watermark blind spot exists one hop
// further up the graph — org-level renames. src/sync/airtable.ts builds the
// Speakers cell from `contact.firstName/lastName` and the Tracks cell from
// `track.name`, but renaming a contact or a track only ever bumped that
// contact's/track's own row, never the submission rows whose pushed shape
// embeds the old string. touchSubmissionsForContacts / touchSubmissionsFor-
// Tracks close that gap: callers pass the contact/track id(s) whose NAME
// just changed (never headshot/notes/other non-serialized fields — see
// DEC-519's same-string no-op precedent at src/routes/api/events.ts) and
// this touches every submission that currently embeds that name. DEC-725's
// wave-32 amendment is explicit about the SHAPE: the dependent submission
// ids are resolved BY SUBQUERY inside one chunked set-based UPDATE per chunk
// ("never a read-then-loop, so a 200-row CSV rename stays one statement per
// chunk") — not by a SELECT round trip whose ids are then fed back into a
// second UPDATE. And still never an EXISTS predicate in airtable.ts itself
// (same DELETE-blindness argument as above).

import { inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";

/** Bumps `submission.updated_at` for every id in `submissionIds` to `now`.
 * Dedupes, no-ops on an empty list, and issues one chunked set-based UPDATE
 * per chunk (never a per-row update, never a read-then-write). Callers pass
 * the submission id or ids whose participant/submission_track composition
 * just changed. */
export async function touchSubmissions(db: Db, submissionIds: string[], now: Date): Promise<void> {
  const ids = [...new Set(submissionIds)];
  if (ids.length === 0) return;
  for (const chunk of chunkIds(ids)) {
    await db.update(schema.submission).set({ updatedAt: now }).where(inArray(schema.submission.id, chunk));
  }
}

/** Bumps `submission.updated_at` for every submission a renamed contact
 * participates in (via `participant.contactId` -> `participant.submissionId`).
 * Set-based, deduped, no-op on an empty list; resolves dependents by
 * subquery and issues one chunked UPDATE per chunk of contact ids so a
 * bulk rename (e.g. CSV import) never becomes a per-row read-then-write. */
export async function touchSubmissionsForContacts(db: Db, contactIds: string[], now: Date): Promise<void> {
  const ids = [...new Set(contactIds)];
  if (ids.length === 0) return;
  for (const chunk of chunkIds(ids)) {
    await db
      .update(schema.submission)
      .set({ updatedAt: now })
      .where(
        inArray(
          schema.submission.id,
          db
            .select({ id: schema.participant.submissionId })
            .from(schema.participant)
            .where(inArray(schema.participant.contactId, chunk)),
        ),
      );
  }
}

/** Bumps `submission.updated_at` for every submission assigned to a renamed
 * track (via `submissionTrack.trackId` -> `submissionTrack.submissionId`).
 * Set-based, deduped, no-op on an empty list; resolves dependents by
 * subquery and issues one chunked UPDATE per chunk of track ids. */
export async function touchSubmissionsForTracks(db: Db, trackIds: string[], now: Date): Promise<void> {
  const ids = [...new Set(trackIds)];
  if (ids.length === 0) return;
  for (const chunk of chunkIds(ids)) {
    await db
      .update(schema.submission)
      .set({ updatedAt: now })
      .where(
        inArray(
          schema.submission.id,
          db
            .select({ id: schema.submissionTrack.submissionId })
            .from(schema.submissionTrack)
            .where(inArray(schema.submissionTrack.trackId, chunk)),
        ),
      );
  }
}
