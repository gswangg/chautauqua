// Submissions repo: list query (DEC-016 list contract). Split out of
// repo/submissions.ts (contention decomposition, no behavior change). See
// repo/submissions.ts for the module-level contract notes.

import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { FILE_KINDS, type FileKind } from "../../../domain/files";
import { chunkIds, type ParsedListQuery, type SortOrder } from "./query";
import { likeContains } from "../like";
import { findRoot, type DeliverableFileRow } from "../files-library";
import { DEC_692 } from "../../../decisions";

// DEC-692: a worklist row names the session, the speaker, the LATEST
// artefact and its status — latestFile is that artefact, computed here.
void DEC_692;

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
  deliverableCounts: { presentation: number; poster: number; handout: number };
  latestFile: { filename: string; kind: FileKind; versionCount: number; uploadedAt: number } | null;
  answers?: Record<string, unknown>;
}

export interface ListSubmissionsResult {
  items: SubmissionListItem[];
  total: number;
}

/** ORDER BY clause for each sort, with a seq tiebreaker (DEC-335) so OFFSET
 * paging stays stable when createdAt/title values tie across rows. */
export function orderByForSort(sort: SortOrder) {
  switch (sort) {
    case "oldest":
      return sql`${schema.submission.createdAt} asc, ${schema.submission.seq} asc`;
    case "title":
      return sql`${schema.submission.title} asc, ${schema.submission.seq} asc`;
    case "ref":
      return sql`${schema.submission.seq} asc`;
    case "worklist":
      // DEC-341: items needing action surface first (SPEC §2.3 — worklist,
      // not report); title/seq tiebreakers keep OFFSET paging stable.
      return sql`case ${schema.submission.contentStatus} when 'changes_requested' then 0 when 'pending' then 1 else 2 end asc, ${schema.submission.title} asc, ${schema.submission.seq} asc`;
    case "newest":
    default:
      return sql`${schema.submission.createdAt} desc, ${schema.submission.seq} desc`;
  }
}

/** WHERE conditions for the submissions list (eventId + status +
 * contentStatus + the correlated q/trackId EXISTS subqueries), extracted so
 * exportSubmissions can apply the identical filter (DEC-649: an export is
 * the same WHERE clause as the list beside it, or the file lies). Pure
 * extraction from listSubmissions below — no behavior change. */
export function submissionListConditions(eventId: string, params: ParsedListQuery) {
  const conditions = [eq(schema.submission.eventId, eventId)];
  if (params.status.length > 0) {
    conditions.push(inArray(schema.submission.status, params.status));
  }
  if (params.contentStatus.length > 0) {
    conditions.push(inArray(schema.submission.contentStatus, params.contentStatus));
  }

  // q / trackId narrowing: pushed into the WHERE clause as correlated
  // EXISTS subqueries (DEC-335) rather than a separate candidate-id pass +
  // JS pagination — one paginated statement, cost bound by the WHERE, not
  // by materializing every matching row.
  if (params.q) {
    const like = likeContains(params.q.toLowerCase());
    conditions.push(
      or(
        sql`lower(${schema.submission.title}) like ${like} escape '\\'`,
        sql`exists (select 1 from ${schema.participant} inner join ${schema.contact} on ${schema.contact.id} = ${schema.participant.contactId} where ${schema.participant.submissionId} = ${schema.submission.id} and lower(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like} escape '\\')`,
      )!,
    );
  }

  if (params.trackId) {
    conditions.push(
      or(
        eq(schema.submission.trackId, params.trackId),
        sql`exists (select 1 from ${schema.submissionTrack} where ${schema.submissionTrack.submissionId} = ${schema.submission.id} and ${schema.submissionTrack.trackId} = ${params.trackId})`,
      )!,
    );
  }

  return conditions;
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

  const conditions = submissionListConditions(eventId, params);

  const offset = (params.page - 1) * params.perPage;
  const whereExpr = and(...conditions);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submission)
    .where(whereExpr);
  const total = Number(totalRows[0]?.count ?? 0);

  const rows = await db
    .select()
    .from(schema.submission)
    .where(whereExpr)
    .orderBy(orderByForSort(params.sort))
    .limit(params.perPage)
    .offset(offset);

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

  // DEC-341: per-page deliverable counts (chain roots only — DEC-247) via
  // ONE grouped query per id chunk, following the tracks/speakers hydration
  // pattern above. Cost bound by page size, not total submission count.
  const deliverableRows: { submissionId: string; kind: string; count: number }[] = [];
  for (const batch of idBatches) {
    const batchRows = await db
      .select({
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        count: sql<number>`count(*)`,
      })
      .from(schema.file)
      .where(
        and(
          inArray(schema.file.submissionId, batch),
          sql`${schema.file.previousFileId} is null`,
          inArray(schema.file.kind, FILE_KINDS as unknown as string[]),
        ),
      )
      .groupBy(schema.file.submissionId, schema.file.kind);
    deliverableRows.push(...(batchRows as { submissionId: string; kind: string; count: number }[]));
  }

  // latestFile (v4 mock worklist column): ONE batched query per id chunk,
  // same style/loop as deliverableCounts above — page-scoped WHERE, never a
  // whole-event scan (DEC-686). Unlike the grouped count query, this needs
  // full rows (previousFileId/createdAt) so the chain can be walked in
  // memory via files-library's findRoot rather than re-derived per file.
  const latestFileCandidateRows: DeliverableFileRow[] = [];
  for (const batch of idBatches) {
    const batchRows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
      })
      .from(schema.file)
      .where(and(inArray(schema.file.submissionId, batch), inArray(schema.file.kind, FILE_KINDS as unknown as string[])));
    for (const r of batchRows as DeliverableFileRow[]) {
      if (r.submissionId) latestFileCandidateRows.push(r);
    }
  }

  const latestFileBySubmission = new Map<
    string,
    { filename: string; kind: FileKind; versionCount: number; uploadedAt: number }
  >();
  {
    const byId = new Map(latestFileCandidateRows.map((f) => [f.id, f]));
    // The globally-newest file row for a submission is, by construction of
    // previous_file_id chaining, always some chain's latest link — no need
    // to separately resolve "latest per chain" before comparing across
    // chains.
    const newestBySubmission = new Map<string, DeliverableFileRow>();
    for (const f of latestFileCandidateRows) {
      const existing = newestBySubmission.get(f.submissionId);
      if (!existing || f.createdAt.getTime() > existing.createdAt.getTime()) {
        newestBySubmission.set(f.submissionId, f);
      }
    }
    const chainsByRoot = new Map<string, DeliverableFileRow[]>();
    for (const f of latestFileCandidateRows) {
      const root = findRoot(f.id, byId);
      const arr = chainsByRoot.get(root) ?? [];
      arr.push(f);
      chainsByRoot.set(root, arr);
    }
    for (const [submissionId, newest] of newestBySubmission) {
      const root = findRoot(newest.id, byId);
      const chain = chainsByRoot.get(root) ?? [newest];
      latestFileBySubmission.set(submissionId, {
        filename: newest.filename,
        kind: newest.kind as FileKind,
        versionCount: chain.length,
        uploadedAt: newest.createdAt.getTime(),
      });
    }
  }

  const deliverableCountsBySubmission = new Map<string, Record<FileKind, number>>();
  for (const d of deliverableRows) {
    if (!d.submissionId) continue;
    const existing =
      deliverableCountsBySubmission.get(d.submissionId) ??
      ({ presentation: 0, poster: 0, handout: 0 } as Record<FileKind, number>);
    existing[d.kind as FileKind] = Number(d.count);
    deliverableCountsBySubmission.set(d.submissionId, existing);
  }

  const speakersBySubmission = new Map<string, { contactId: string; name: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ contactId: p.contactId, name: `${p.firstName} ${p.lastName}`.trim(), order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values())
    arr.sort((a, b) => a.order - b.order || (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0));

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
      deliverableCounts:
        deliverableCountsBySubmission.get(r.id) ?? { presentation: 0, poster: 0, handout: 0 },
      latestFile: latestFileBySubmission.get(r.id) ?? null,
      ...(params.includeAnswers ? { answers: answersBySubmission.get(r.id) ?? {} } : {}),
    };
  });

  return { items, total };
}
