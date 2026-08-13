// DEC-855: submission_track is the ONLY source of a submission's tracks.
// Every reader that needs a submission's track name(s) must go through this
// helper — never re-derive from the submission row's own scalar track
// column (dead, DEC-855) or hand-roll a per-row query.
import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";

export async function loadTrackNamesBySubmission(
  db: Db,
  submissionIds: string[],
): Promise<Map<string, string[]>> {
  const trackNamesBySubmission = new Map<string, string[]>();
  if (submissionIds.length === 0) return trackNamesBySubmission;

  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, name: schema.track.name })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch))
      .orderBy(asc(schema.track.position), asc(schema.track.id));
    for (const t of batchRows) {
      const list = trackNamesBySubmission.get(t.submissionId) ?? [];
      list.push(t.name);
      trackNamesBySubmission.set(t.submissionId, list);
    }
  }
  return trackNamesBySubmission;
}
