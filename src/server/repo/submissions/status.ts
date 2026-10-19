// Submissions repo: status change (DEC-009: no email). Split out of
// repo/submissions.ts (contention decomposition, no behavior change). This
// module deliberately contains NO mail/mailer import (DEC-009 invariant #1)
// -- verified by a source-scan test in test/api-submissions.test.ts.
//
// Multi-portal decision 76: acceptance creates no tasks of its own any more.
// It used to plan the DEC-009 default onboarding set and back-fill every
// "everyone accepted" task onto each newly accepted speaker -- two rule
// engines running beside portals. Portals are the one engine now: an
// acceptance changes a participation, the routes schedule a portal
// reconcile (src/server/portal-sync.ts), and the portals that cover the
// person bring their items. New events start with Profile basics and CFP
// speakers (src/routes/api/events.ts).
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { changeStatus, type SubmissionStatus } from "../../../domain/status";
import { isValidStatusLiteral } from "./query";
import { chunkIds } from "../../../lib/chunk";
import { ApiError } from "../../http";
import { DEC_079, DEC_133, DEC_520, DEC_521, DEC_932 } from "../../../decisions";

void DEC_079; // bulk status changes below are chunked (its planning-before-commit half went with decision 76)
void DEC_133; // full-set id match guard below (mirrors DEC-122's requireFullMatch)
void DEC_520; // superseded by multi-portal decision 76: portal items carry their own deadlines
void DEC_521; // superseded by multi-portal decision 76: acceptance writes no task_assignment rows
void DEC_932; // superseded by multi-portal decision 76: a portal back-fills its items onto everyone it covers (portals/reconcile.ts)

export interface SubmissionStatusForParticipant {
  submissionId: string;
  eventId: string;
  status: string;
}

/**
 * DEC-278: given a participant row id, resolves its parent submission's
 * (id, eventId, status). The portal invitation handler uses the event id
 * to reconcile that event's portals once the invitation is answered.
 */
export async function getSubmissionStatusForParticipant(
  db: Db,
  participantId: string,
): Promise<SubmissionStatusForParticipant | null> {
  const rows = await db
    .select({
      submissionId: schema.submission.id,
      eventId: schema.submission.eventId,
      status: schema.submission.status,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

export interface UpdateStatusesResult {
  updated: number;
}

/**
 * Sets `status` on every submission id in `ids` that belongs to `eventId`.
 * NEVER sends email (DEC-009 invariant #1 — no mailer import in this
 * module) and creates no tasks: since multi-portal decision 76 the portals
 * an accepted speaker matches bring the tasks, once the caller reconciles.
 *
 * DEC-133 (DEC-122-style full-set match): every distinct id in `ids` must
 * belong to `eventId`, checked BEFORE any mutation — if one or more ids are
 * unknown/foreign, throws ApiError('invalid', ...) naming the missing ids
 * and applies zero DB changes. Duplicate ids within `ids` are tolerated
 * (deduped up front) and do not trigger the guard.
 *
 * DEC-009 wave-26 amendment: `changeStatus`'s `setsAcceptedAt` stamps
 * accepted_at the first time a row is accepted, and repairs an
 * already-'accepted' row whose accepted_at is null. Every requested id lands
 * in exactly one stamp/no-stamp chunked UPDATE; the no-stamp UPDATE never
 * touches accepted_at, preserving the original stamp. The stamp write only
 * ever sets accepted_at from null, so a retry after a partial failure
 * converges to the same terminal state.
 */
export async function updateSubmissionStatuses(
  db: Db,
  eventId: string,
  ids: string[],
  status: SubmissionStatus,
  now: Date,
): Promise<UpdateStatusesResult> {
  if (ids.length === 0) return { updated: 0 };

  const rows: { id: string; status: string; acceptedAt: Date | null }[] = [];
  for (const idChunk of chunkIds(ids)) {
    const chunkRows = await db
      .select({
        id: schema.submission.id,
        status: schema.submission.status,
        acceptedAt: schema.submission.acceptedAt,
      })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
    rows.push(...chunkRows);
  }

  const requested = [...new Set(ids)];
  const foundIdSet = new Set(rows.map((r) => r.id));
  const missing = requested.filter((id) => !foundIdSet.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more submission ids do not belong to this event", {
      ids: `unknown ids: ${missing.join(", ")}`,
    });
  }

  const stampIds: string[] = [];
  for (const row of rows) {
    const currentStatus = isValidStatusLiteral(row.status) ? row.status : "pending";
    const result = changeStatus(
      { status: currentStatus, acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null },
      status,
      now.getTime(),
    );
    if (result.setsAcceptedAt) stampIds.push(row.id);
  }

  for (const idChunk of chunkIds(stampIds)) {
    if (idChunk.length === 0) continue;
    await db
      .update(schema.submission)
      .set({ status, acceptedAt: now, updatedAt: now })
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
  }

  // Every other id never touches accepted_at via this UPDATE, preserving
  // the original stamp (DEC-278 amendment).
  const stampIdSet = new Set(stampIds);
  const nonStampIds = [...new Set(rows.map((r) => r.id))].filter((id) => !stampIdSet.has(id));
  for (const idChunk of chunkIds(nonStampIds)) {
    if (idChunk.length === 0) continue;
    await db
      .update(schema.submission)
      .set({ status, updatedAt: now })
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
  }

  return { updated: rows.length };
}
