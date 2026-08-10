// Submissions repo: list query (DEC-016 list contract). Split out of
// repo/submissions.ts (contention decomposition, no behavior change). See
// repo/submissions.ts for the module-level contract notes.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds, ID_CHUNK_SIZE, type ParsedListQuery, type SortOrder } from "./query";

export interface SubmissionSpeaker {
  contactId: string;
  name: string;
}

export interface SubmissionListItem {
  id: string;
  ref: string;
  title: string;
  status: string;
  contentStatus: string;
  speakers: SubmissionSpeaker[];
  trackIds: string[];
  submittedAt: number | null;
  createdAt: number;
  answers?: Record<string, unknown>;
}

export interface ListSubmissionsResult {
  items: SubmissionListItem[];
  total: number;
}

function orderByForSort(sort: SortOrder) {
  switch (sort) {
    case "oldest":
      return sql`${schema.submission.createdAt} asc`;
    case "title":
      return sql`${schema.submission.title} asc`;
    case "ref":
      return sql`${schema.submission.seq} asc`;
    case "newest":
    default:
      return sql`${schema.submission.createdAt} desc`;
  }
}

/** JS mirror of orderByForSort's SQL ordering, used only by the batched
 * allowedIds fallback below (>ID_CHUNK_SIZE candidate ids, where results
 * come from multiple merged queries instead of one ORDER BY). Pure,
 * unit-tested directly. */
export function sortSubmissionRows<T extends { title: string; seq: number; createdAt: Date }>(
  rows: T[],
  sort: SortOrder,
): T[] {
  const out = [...rows];
  switch (sort) {
    case "oldest":
      out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      break;
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "ref":
      out.sort((a, b) => a.seq - b.seq);
      break;
    case "newest":
    default:
      out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
  }
  return out;
}

export async function listSubmissions(
  db: Db,
  eventId: string,
  params: ParsedListQuery,
): Promise<ListSubmissionsResult> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const conditions = [eq(schema.submission.eventId, eventId)];
  if (params.status.length > 0) {
    conditions.push(inArray(schema.submission.status, params.status));
  }

  // Candidate-id narrowing for q / trackId: a handful of aggregate queries
  // over the whole event, never per-row of the result page (no N+1).
  let allowedIds: Set<string> | null = null;

  if (params.q) {
    const like = `%${params.q.toLowerCase()}%`;
    const titleRows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(
        and(eq(schema.submission.eventId, eventId), sql`lower(${schema.submission.title}) like ${like}`),
      );
    const nameRows = await db
      .select({ submissionId: schema.participant.submissionId })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .where(
        and(
          eq(schema.submission.eventId, eventId),
          sql`lower(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like}`,
        ),
      );
    const ids = new Set<string>();
    for (const r of titleRows) ids.add(r.id);
    for (const r of nameRows) ids.add(r.submissionId);
    allowedIds = ids;
  }

  if (params.trackId) {
    const primaryRows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.trackId, params.trackId)));
    const joinRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId })
      .from(schema.submissionTrack)
      .where(eq(schema.submissionTrack.trackId, params.trackId));
    const trackMatch = new Set<string>();
    for (const r of primaryRows) trackMatch.add(r.id);
    for (const r of joinRows) trackMatch.add(r.submissionId);
    allowedIds = allowedIds ? new Set([...allowedIds].filter((id) => trackMatch.has(id))) : trackMatch;
  }

  if (allowedIds !== null && allowedIds.size === 0) return { items: [], total: 0 };

  // D1 rejects a statement once its bound-parameter count crosses the same
  // ~100 ceiling documented by ID_CHUNK_SIZE above. A q/trackId match can
  // legitimately narrow to more than ID_CHUNK_SIZE candidate ids in one
  // event, so a single inArray(...) folded into the paginated query (as
  // below) would crash exactly like the per-page enrichment queries did.
  // Below that ceiling, keep the original single-query path (same
  // behavior, same perf). At/above it, batch the id-scoped fetch and
  // total across chunks and paginate/sort in JS instead of SQL.
  const offset = (params.page - 1) * params.perPage;
  let total: number;
  let rows: (typeof schema.submission.$inferSelect)[];

  if (allowedIds !== null && allowedIds.size > ID_CHUNK_SIZE) {
    const baseWhereExpr = and(...conditions);
    const idBatchesForFilter = chunkIds([...allowedIds]);
    let allMatching: (typeof schema.submission.$inferSelect)[] = [];
    for (const batch of idBatchesForFilter) {
      const batchRows = await db
        .select()
        .from(schema.submission)
        .where(and(baseWhereExpr, inArray(schema.submission.id, batch)));
      allMatching = allMatching.concat(batchRows);
    }
    allMatching = sortSubmissionRows(allMatching, params.sort);
    total = allMatching.length;
    rows = allMatching.slice(offset, offset + params.perPage);
  } else {
    if (allowedIds !== null) {
      conditions.push(inArray(schema.submission.id, [...allowedIds]));
    }
    const whereExpr = and(...conditions);

    const totalRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.submission)
      .where(whereExpr);
    total = Number(totalRows[0]?.count ?? 0);

    rows = await db
      .select()
      .from(schema.submission)
      .where(whereExpr)
      .orderBy(orderByForSort(params.sort))
      .limit(params.perPage)
      .offset(offset);
  }

  if (rows.length === 0) return { items: [], total };

  const ids = rows.map((r) => r.id);
  const idBatches = chunkIds(ids);

  const participantRows: {
    submissionId: string;
    contactId: string;
    firstName: string;
    lastName: string;
    order: number;
  }[] = [];
  for (const batch of idBatches) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        contactId: schema.participant.contactId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        order: schema.participant.order,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...batchRows);
  }

  const trackRows: { submissionId: string; trackId: string }[] = [];
  for (const batch of idBatches) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
      .from(schema.submissionTrack)
      .where(inArray(schema.submissionTrack.submissionId, batch));
    trackRows.push(...batchRows);
  }

  let answerRows: { submissionId: string; formFieldId: string; valueJson: string }[] = [];
  if (params.includeAnswers) {
    for (const batch of idBatches) {
      const batchRows = await db
        .select({
          submissionId: schema.submissionAnswer.submissionId,
          formFieldId: schema.submissionAnswer.formFieldId,
          valueJson: schema.submissionAnswer.valueJson,
        })
        .from(schema.submissionAnswer)
        .where(inArray(schema.submissionAnswer.submissionId, batch));
      answerRows.push(...batchRows);
    }
  }

  const speakersBySubmission = new Map<string, { contactId: string; name: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ contactId: p.contactId, name: `${p.firstName} ${p.lastName}`.trim(), order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) arr.sort((a, b) => a.order - b.order);

  const tracksBySubmission = new Map<string, string[]>();
  for (const t of trackRows) {
    const arr = tracksBySubmission.get(t.submissionId) ?? [];
    arr.push(t.trackId);
    tracksBySubmission.set(t.submissionId, arr);
  }

  const answersBySubmission = new Map<string, Record<string, unknown>>();
  for (const a of answerRows) {
    const map = answersBySubmission.get(a.submissionId) ?? {};
    map[a.formFieldId] = JSON.parse(a.valueJson);
    answersBySubmission.set(a.submissionId, map);
  }

  const items: SubmissionListItem[] = rows.map((r) => {
    const speakers = (speakersBySubmission.get(r.id) ?? []).map(({ contactId, name }) => ({
      contactId,
      name,
    }));
    const joinedTracks = tracksBySubmission.get(r.id) ?? [];
    const trackIds = r.trackId
      ? [...new Set([r.trackId, ...joinedTracks])]
      : [...new Set(joinedTracks)];
    return {
      id: r.id,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      status: r.status,
      contentStatus: r.contentStatus,
      speakers,
      trackIds,
      submittedAt: r.createdAt.getTime(),
      createdAt: r.createdAt.getTime(),
      ...(params.includeAnswers ? { answers: answersBySubmission.get(r.id) ?? {} } : {}),
    };
  });

  return { items, total };
}
