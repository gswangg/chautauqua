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
import { DEC_692, DEC_780, DEC_881, DEC_913 } from "../../../decisions";
import { CONTENT_STATUSES, isContentStatus } from "../../../domain/content-status";
import { parseSubmissionAnswerValue } from "../../../forms/answer-json";

// DEC-780 (DEC-051 amendment, findings wave 8): the submission LIST payload
// gains the slot the submission DETAIL payload already carries — same shape,
// reused verbatim (SubmissionDetailSlot is defined here, canonically, and
// re-exported for detail.ts to import — detail.ts already imports
// reUploadedSql from this module, so the dependency direction was already
// list.ts -> detail.ts-free; keeping the shared type here avoids a cycle).
void DEC_780;

// DEC-692: a worklist row names the session, the speaker, the LATEST
// artefact and its status — latestFile is that artefact, computed here.
void DEC_692;

// DEC-913: the worklist's chip counts and re-uploaded headline are ONE
// grouped aggregate on the list envelope, not one request per tab.
void DEC_913;

// DEC-881: "re-uploaded" is ONE predicate — a submission's latest deliverable
// file (by created_at among FILE_KINDS files) has version_no > 1. Expressed
// once as reUploadedSql below; submissionListConditions and the row
// projection both read it, so the header's aggregate and the row's status
// cell can never disagree.
void DEC_881;

/** DEC-881's predicate as a scalar SQL subquery: the version_no of a
 * submission's newest deliverable file, or NULL when it has none. Read
 * directly off file.version_no (DEC-818: an insert-time identity, not a
 * position among survivors) rather than a chain-length count, so a deleted
 * middle version never flips the answer. A function, not a module-level
 * const — building the sql.join at call time avoids relying on drizzle-orm's
 * `sql` export being fully initialized before this module's top-level runs
 * (import-order-sensitive under some bundlers/test runners). */
function latestDeliverableVersionNoSql() {
  return sql`(select ${schema.file.versionNo} from ${schema.file} where ${schema.file.submissionId} = ${schema.submission.id} and ${schema.file.kind} in (${sql.join(
    (FILE_KINDS as readonly string[]).map((k) => sql`${k}`),
    sql`, `,
  )}) order by ${schema.file.createdAt} desc, ${schema.file.id} desc limit 1)`;
}

/** DEC-881: a submission is re-uploaded when its latest deliverable file's
 * version_no > 1. NULL (no files yet) is not re-uploaded. */
export function reUploadedSql() {
  return sql`coalesce(${latestDeliverableVersionNoSql()} > 1, 0)`;
}

export interface SubmissionSpeaker {
  contactId: string;
  name: string;
}

// DEC-780: the one slot shape shared by the submission LIST and DETAIL
// payloads. Defined here (list.ts) and imported by detail.ts, which already
// depends on this module for reUploadedSql.
export interface SubmissionDetailSlot {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
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
  latestFile: { filename: string; kind: FileKind; versionCount: number; uploadedAt: number } | null;
  // DEC-881: the single re-uploaded predicate (latest deliverable file's
  // stored version_no, DEC-818 identity, > 1) — false when the submission
  // has no deliverable files yet. w1-d/DEC-851 amendment: the raw version_no
  // itself used to ride the wire alongside this boolean with no reader
  // anywhere under app/src (latestFileByKind's per-kind summary superseded
  // it for display) -- removed from the wire; still computed as a local
  // below to derive this boolean.
  reuploaded: boolean;
  // w5-i (DEC-708 amendment scope): a per-kind latest version_no, so the
  // worklist's Latest file column can print a per-kind summary ("Slides v3 ·
  // Recording v1") instead of collapsing to the single globally-newest
  // upload's filename+version -- a submission with both a re-uploaded deck
  // AND a first-time recording otherwise hides the recording entirely.
  // Batched off the same latestFileCandidateRows query below, never a
  // second per-kind fetch.
  latestFileByKind: Partial<Record<FileKind, number>>;
  answers?: Record<string, unknown>;
  // w41-b: the worklist SESSION cell's subtitle (DEC-902 amendment) --
  // batched off schedule_slot/room the same way latestFile is, never a
  // per-row fetch. null for a submission not yet placed on the
  // agenda.
  scheduled: SubmissionDetailSlot | null;
  // w8-d (DEC-051/DEC-780 amendment, findings wave 8): the same slot the
  // submission DETAIL payload carries, reused verbatim so there is one slot
  // shape in the SPA -- Compose step 1 renders this so the fact that decides
  // whether a calendar invite can be attached is visible before an audience
  // is chosen and a message is written, not first refused at step 3. Sourced
  // from the same schedule_slot/room batch as `scheduled` above -- never a
  // second per-row lookup.
  slot: SubmissionDetailSlot | null;
}

// DEC-003 wave-73 amendment: one key per CONTENT_STATUSES member, derived
// rather than hand-listed -- a fourth member now widens this type instead of
// being silently dropped from the worklist chip counts.
export type SubmissionContentStatusCounts = Record<(typeof CONTENT_STATUSES)[number], number>;

export interface ListSubmissionsResult {
  items: SubmissionListItem[];
  total: number;
  // DEC-913: the worklist's chip counts and 're-uploaded' headline are ONE
  // grouped aggregate over the SAME filtered base (eventId/q/trackId) minus
  // this call's own contentStatus/reuploaded narrowing — so the numbers
  // never move when the caller switches tabs, and the chips/headline/rows
  // read one query's arithmetic instead of four separate bounded reads.
  contentStatusCounts: SubmissionContentStatusCounts;
  reuploadedCount: number;
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
  if (params.reuploaded !== null) {
    // DEC-881: reuploaded=1 filters to the exact predicate the row
    // projection's `reuploaded` field reads below — the bounded (perPage=1)
    // aggregate read the header's count uses and the rows it summarizes can
    // never disagree.
    conditions.push(params.reuploaded ? sql`${reUploadedSql()} = 1` : sql`${reUploadedSql()} = 0`);
  }

  // q / trackId narrowing: pushed into the WHERE clause as correlated
  // EXISTS subqueries (DEC-335) rather than a separate candidate-id pass +
  // JS pagination — one paginated statement, cost bound by the WHERE, not
  // by materializing every matching row.
  if (params.q) {
    const like = likeContains(params.q);
    conditions.push(
      or(
        sql`${schema.submission.title} like ${like} escape '\\'`,
        sql`exists (select 1 from ${schema.participant} inner join ${schema.contact} on ${schema.contact.id} = ${schema.participant.contactId} where ${schema.participant.submissionId} = ${schema.submission.id} and (${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like} escape '\\')`,
      )!,
    );
  }

  if (params.trackId) {
    conditions.push(
      sql`exists (select 1 from ${schema.submissionTrack} where ${schema.submissionTrack.submissionId} = ${schema.submission.id} and ${schema.submissionTrack.trackId} = ${params.trackId})`,
    );
  }

  return conditions;
}

export async function listSubmissions(
  db: Db,
  eventId: string,
  params: ParsedListQuery,
): Promise<ListSubmissionsResult> {
  const conditions = submissionListConditions(eventId, params);

  const offset = (params.page - 1) * params.perPage;
  const whereExpr = and(...conditions);

  // DEC-913: chip counts + re-uploaded headline as ONE grouped aggregate
  // over the same base filter (eventId/q/trackId) with this call's own
  // contentStatus/reuploaded narrowing stripped — so a tab switch (which
  // only changes params.contentStatus) never moves these numbers, and the
  // conditional re-uploaded sum rides the same GROUP BY pass rather than a
  // second query.
  const countConditions = submissionListConditions(eventId, { ...params, contentStatus: [], reuploaded: null });
  const countWhereExpr = and(...countConditions);

  // DEC-370 (wave-62 amendment): the event lookup, the total count, the
  // grouped chip/re-uploaded count, and the page of rows all derive solely
  // from eventId/params — none reads another's result — so WAVE 1 issues
  // all four concurrently instead of as four sequential round trips. Array
  // order matches the pre-wave sequential order.
  const [eventRows, totalRows, countRows, rows] = await Promise.all([
    db.select({ recordPrefix: schema.event.recordPrefix }).from(schema.event).where(eq(schema.event.id, eventId)).limit(1),
    db.select({ count: sql<number>`count(*)` }).from(schema.submission).where(whereExpr),
    db
      .select({
        contentStatus: schema.submission.contentStatus,
        count: sql<number>`count(*)`,
        reuploaded: sql<number>`sum(case when ${reUploadedSql()} = 1 then 1 else 0 end)`,
      })
      .from(schema.submission)
      .where(countWhereExpr)
      .groupBy(schema.submission.contentStatus),
    db
      .select()
      .from(schema.submission)
      .where(whereExpr)
      .orderBy(orderByForSort(params.sort))
      .limit(params.perPage)
      .offset(offset),
  ]);

  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";
  const total = Number(totalRows[0]?.count ?? 0);

  const contentStatusCounts = Object.fromEntries(
    CONTENT_STATUSES.map((status) => [status, 0]),
  ) as SubmissionContentStatusCounts;
  let reuploadedCount = 0;
  for (const r of countRows) {
    if (isContentStatus(r.contentStatus)) {
      contentStatusCounts[r.contentStatus] = Number(r.count);
    }
    reuploadedCount += Number(r.reuploaded ?? 0);
  }

  if (rows.length === 0) return { items: [], total, contentStatusCounts, reuploadedCount };

  const ids = rows.map((r) => r.id);
  const idBatches = chunkIds(ids);

  type LatestFileCandidateRow = DeliverableFileRow & { versionNo: number | null };

  // DEC-370 (wave-62 amendment): every hydration loop below is keyed by the
  // same page id set and independent of the others, so WAVE 2 issues every
  // chunk batch, across all six hydration reads, concurrently in a single
  // Promise.all rather than six sequential chunk loops. The includeAnswers
  // loop simply contributes an empty array of promises when the flag is
  // off. Chunking (chunkIds) is unchanged — one batch of promises per
  // hydration read, not a single combined query.
  const [
    participantBatches,
    trackBatches,
    answerBatches,
    latestFileCandidateBatches,
    scheduledBatches,
  ] = await Promise.all([
    Promise.all(
      idBatches.map((batch) =>
        db
          .select({
            submissionId: schema.participant.submissionId,
            contactId: schema.participant.contactId,
            firstName: schema.contact.firstName,
            lastName: schema.contact.lastName,
            order: schema.participant.order,
          })
          .from(schema.participant)
          .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
          .where(inArray(schema.participant.submissionId, batch)),
      ),
    ),
    Promise.all(
      idBatches.map((batch) =>
        db
          .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
          .from(schema.submissionTrack)
          .where(inArray(schema.submissionTrack.submissionId, batch)),
      ),
    ),
    Promise.all(
      params.includeAnswers
        ? idBatches.map((batch) =>
            db
              .select({
                submissionId: schema.submissionAnswer.submissionId,
                formFieldId: schema.submissionAnswer.formFieldId,
                valueJson: schema.submissionAnswer.valueJson,
              })
              .from(schema.submissionAnswer)
              .where(inArray(schema.submissionAnswer.submissionId, batch)),
          )
        : [],
    ),
    // latestFile (v4 mock worklist column): ONE batched query per id chunk,
    // page-scoped WHERE, never a whole-event scan (DEC-686). Unlike a
    // grouped count query, this needs
    // full rows (previousFileId/createdAt) so the chain can be walked in
    // memory via files-library's findRoot rather than re-derived per file.
    // DEC-881: versionNo rides along on the same candidate-row query so the
    // re-uploaded predicate reads the same "newest by created_at" row the
    // latestFile column already resolves — never a second query that could
    // disagree on which file is "latest".
    Promise.all(
      idBatches.map((batch) =>
        db
          .select({
            id: schema.file.id,
            submissionId: schema.file.submissionId,
            kind: schema.file.kind,
            filename: schema.file.filename,
            previousFileId: schema.file.previousFileId,
            createdAt: schema.file.createdAt,
            sizeBytes: schema.file.sizeBytes,
            uploadedByContactId: schema.file.uploadedByContactId,
            versionNo: schema.file.versionNo,
          })
          .from(schema.file)
          .where(and(inArray(schema.file.submissionId, batch), inArray(schema.file.kind, FILE_KINDS as unknown as string[]))),
      ),
    ),
    Promise.all(
      idBatches.map((batch) =>
        db
          .select({
            submissionId: schema.scheduleSlot.submissionId,
            day: schema.scheduleSlot.day,
            startMin: schema.scheduleSlot.startMin,
            endMin: schema.scheduleSlot.endMin,
            roomName: schema.room.name,
          })
          .from(schema.scheduleSlot)
          .leftJoin(schema.room, eq(schema.room.id, schema.scheduleSlot.roomId))
          .where(inArray(schema.scheduleSlot.submissionId, batch)),
      ),
    ),
  ]);

  const participantRows: {
    submissionId: string;
    contactId: string;
    firstName: string;
    lastName: string;
    order: number;
  }[] = participantBatches.flat();

  const trackRows: { submissionId: string; trackId: string }[] = trackBatches.flat();

  const answerRows: { submissionId: string; formFieldId: string; valueJson: string }[] = answerBatches.flat();

  const latestFileCandidateRows: LatestFileCandidateRow[] = [];
  for (const batch of latestFileCandidateBatches) {
    for (const r of batch as LatestFileCandidateRow[]) {
      if (r.submissionId) latestFileCandidateRows.push(r);
    }
  }

  const latestFileBySubmission = new Map<
    string,
    { filename: string; kind: FileKind; versionCount: number; uploadedAt: number }
  >();
  // DEC-881: latest deliverable file's stored version_no, keyed the same as
  // latestFileBySubmission above — read off the identical "newest" row.
  const latestFileVersionNoBySubmission = new Map<string, number | null>();
  // w5-i: highest version_no seen per (submission, kind) -- the newest row
  // FOR THAT KIND, not the globally-newest row across kinds, so a kind that
  // isn't the most-recently-touched one still reports its own true version.
  const latestFileByKindBySubmission = new Map<string, Partial<Record<FileKind, number>>>();
  {
    const byId = new Map(latestFileCandidateRows.map((f) => [f.id, f]));
    // The globally-newest file row for a submission is, by construction of
    // previous_file_id chaining, always some chain's latest link — no need
    // to separately resolve "latest per chain" before comparing across
    // chains.
    const newestBySubmission = new Map<string, LatestFileCandidateRow>();
    for (const f of latestFileCandidateRows) {
      const existing = newestBySubmission.get(f.submissionId);
      if (!existing || f.createdAt.getTime() > existing.createdAt.getTime()) {
        newestBySubmission.set(f.submissionId, f);
      }
    }
    const chainsByRoot = new Map<string, LatestFileCandidateRow[]>();
    for (const f of latestFileCandidateRows) {
      const root = findRoot(f.id, byId);
      const arr = chainsByRoot.get(root) ?? [];
      arr.push(f);
      chainsByRoot.set(root, arr);
    }
    // w5-i: per (submission, kind) newest version_no -- max version_no among
    // that kind's candidate rows for the submission (a chain's head always
    // carries the chain's highest version_no, DEC-965 identity).
    for (const f of latestFileCandidateRows) {
      const byKind = latestFileByKindBySubmission.get(f.submissionId) ?? {};
      const kind = f.kind as FileKind;
      const existingNo = byKind[kind] ?? 0;
      if ((f.versionNo ?? 0) > existingNo) byKind[kind] = f.versionNo ?? existingNo;
      latestFileByKindBySubmission.set(f.submissionId, byKind);
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
      latestFileVersionNoBySubmission.set(submissionId, newest.versionNo);
    }
  }

  // w41-b (DEC-902 amendment): the worklist SESSION cell's subtitle needs
  // the submission's placed schedule_slot + room, batched per id chunk the
  // same way latestFile is above -- never a per-row
  // fetch. A submission with no schedule_slot row simply isn't in the
  // batch's result set.
  const scheduledBySubmission = new Map<
    string,
    { day: string; startMin: number; endMin: number; roomName: string | null }
  >();
  for (const batch of scheduledBatches) {
    for (const r of batch) {
      if (!r.submissionId) continue;
      scheduledBySubmission.set(r.submissionId, {
        day: r.day,
        startMin: r.startMin,
        endMin: r.endMin,
        roomName: r.roomName ?? null,
      });
    }
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
    map[a.formFieldId] = parseSubmissionAnswerValue(a.valueJson, a.formFieldId);
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
    // DEC-881: the same predicate the SQL filter above applies — a
    // submission's latest deliverable file's version_no > 1.
    const latestFileVersionNo = latestFileVersionNoBySubmission.get(r.id) ?? null;
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
      latestFile: latestFileBySubmission.get(r.id) ?? null,
      latestFileByKind: latestFileByKindBySubmission.get(r.id) ?? {},
      reuploaded: latestFileVersionNo !== null && latestFileVersionNo > 1,
      scheduled: scheduledBySubmission.get(r.id) ?? null,
      slot: scheduledBySubmission.get(r.id) ?? null,
      ...(params.includeAnswers ? { answers: answersBySubmission.get(r.id) ?? {} } : {}),
    };
  });

  return { items, total, contentStatusCounts, reuploadedCount };
}
