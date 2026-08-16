// submissions export (J12, DEC-027). Track membership reads ONLY
// submission_track (DEC-017/DEC-855) — the submission row's own scalar
// track columns are frozen legacy and never read here.

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { submissionListConditions, orderByForSort } from "../submissions/list";
import type { ParsedListQuery } from "../submissions/query";
// DEC-515: lockedFieldName is the ONLY test for "is this a locked built-in"
// form field — used to exclude locked session/speaker fields (their answers
// live on the submission row / participant snapshot, never submission_answer)
// from the dynamic custom-field export columns.
import { lockedFieldName } from "../../../forms/types";
import { DEC_017, DEC_027 } from "../../../decisions";
import { answerExportCell } from "../../../domain/answer-text";
import { type ExportTable, type CustomFieldColumn, EXPORT_MAX_ROWS, buildTable, nameCustomColumns } from "./table";
import { getRecordPrefix } from "./common";
import { parseSubmissionAnswerValue } from "../../../forms/answer-json";

void DEC_017;
void DEC_027;

export const SUBMISSIONS_HEADER = [
  "ref",
  "title",
  "status",
  "contentStatus",
  "tracks",
  "speakers",
  "speakerEmails",
  "createdAt",
] as const;

export interface SubmissionExportInput {
  ref: string;
  title: string;
  status: string;
  contentStatus: string;
  tracks: string[];
  speakers: string[];
  speakerEmails: string[];
  createdAt: string;
  description: string;
  /** Custom form-field answers keyed by form_field.id, unvalidated JSON
   * values as parsed from submission_answer.value_json. Only holds keys
   * present in `customFields` below (locked built-ins never appear here —
   * their data already lives in the fixed columns above). */
  answers: Record<string, unknown>;
}

/** A custom (non-locked-built-in) form field to render as its own dynamic
 * export column, ordered/deduped by the caller (exportSubmissions). */
export type SubmissionCustomFieldColumn = CustomFieldColumn;

// The full set of fixed (non-dynamic) submissions export columns — a custom
// field's label collides with one of these iff it would silently shadow a
// fixed column in JSON records (buildTable keys records by header string).
const FIXED_SUBMISSIONS_COLUMN_NAMES = new Set<string>([...SUBMISSIONS_HEADER, "description"]);

export function shapeSubmissionsExport(
  inputs: SubmissionExportInput[],
  customFields: SubmissionCustomFieldColumn[] = [],
): ExportTable {
  const customColumnNames = nameCustomColumns(customFields, FIXED_SUBMISSIONS_COLUMN_NAMES);
  const header = [...SUBMISSIONS_HEADER, "description", ...customColumnNames];
  const rows = inputs.map((s) => [
    s.ref,
    s.title,
    s.status,
    s.contentStatus,
    s.tracks.join("; "),
    s.speakers.join("; "),
    s.speakerEmails.join("; "),
    s.createdAt,
    s.description,
    ...customFields.map((f) => answerExportCell(s.answers[f.fieldId])),
  ]);
  return buildTable(header, rows);
}

// DEC-649: an export is the same WHERE clause as the list beside it, or the
// file lies — when `params` is supplied (kind === 'submissions' only, via
// buildExport), the export applies the identical submissionListConditions +
// orderByForSort listSubmissions uses, unpaginated. With no params, behavior
// is byte-identical to before this filter was threaded through.
export async function exportSubmissions(
  db: Db,
  eventId: string,
  params?: ParsedListQuery,
): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);

  const whereExpr = params ? and(...submissionListConditions(eventId, params)) : eq(schema.submission.eventId, eventId);
  const orderExpr = params ? orderByForSort(params.sort) : asc(schema.submission.seq);

  const submissions = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      description: schema.submission.description,
      status: schema.submission.status,
      contentStatus: schema.submission.contentStatus,
      createdAt: schema.submission.createdAt,
    })
    .from(schema.submission)
    .where(whereExpr)
    .orderBy(orderExpr)
    .limit(EXPORT_MAX_ROWS + 1);

  // DEC-027 amendment (wave 50): bound on the query, not after the rows are
  // in memory — the cap+1 row proves overflow; drop it and skip every
  // downstream join fetch below rather than materializing them too.
  if (submissions.length > EXPORT_MAX_ROWS) {
    return buildTable([...SUBMISSIONS_HEADER, "description"], [], true);
  }

  if (submissions.length === 0) return shapeSubmissionsExport([]);
  const ids = submissions.map((s) => s.id);

  const trackJoinRows: { submissionId: string; trackName: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackName: schema.track.name })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch));
    trackJoinRows.push(...batchRows);
  }

  const participantRows: {
    submissionId: string;
    order: number;
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        contactId: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...batchRows);
  }

  const tracksBySubmission = new Map<string, Set<string>>();
  for (const t of trackJoinRows) {
    const set = tracksBySubmission.get(t.submissionId) ?? new Set<string>();
    set.add(t.trackName);
    tracksBySubmission.set(t.submissionId, set);
  }

  const speakersBySubmission = new Map<
    string,
    { name: string; email: string; order: number; contactId: string }[]
  >();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ name: `${p.firstName} ${p.lastName}`.trim(), email: p.email, order: p.order, contactId: p.contactId });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) {
    arr.sort((a, b) => a.order - b.order || (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0));
  }

  // DEC-515: enumerate every non-locked-built-in form_field belonging to
  // this event's forms, ordered by (form, position) and deduped by field
  // id, as the export's dynamic custom-field columns.
  const formRows = await db.select({ id: schema.form.id }).from(schema.form).where(eq(schema.form.eventId, eventId));
  const formIds = formRows.map((f) => f.id);

  const fieldRows: { id: string; formId: string; position: number; label: string }[] = [];
  for (const batch of chunkIds(formIds)) {
    const batchRows = await db
      .select({
        id: schema.formField.id,
        formId: schema.formField.formId,
        position: schema.formField.position,
        label: schema.formField.label,
      })
      .from(schema.formField)
      .where(inArray(schema.formField.formId, batch));
    fieldRows.push(...batchRows);
  }

  const customFields: SubmissionCustomFieldColumn[] = [];
  const seenFieldIds = new Set<string>();
  for (const f of [...fieldRows].sort((a, b) => (a.formId === b.formId ? a.position - b.position : a.formId < b.formId ? -1 : 1))) {
    if (lockedFieldName(f.id) !== null) continue;
    if (seenFieldIds.has(f.id)) continue;
    seenFieldIds.add(f.id);
    customFields.push({ fieldId: f.id, label: f.label });
  }

  const answerRows: { submissionId: string; formFieldId: string; valueJson: string }[] = [];
  for (const batch of chunkIds(ids)) {
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

  const answersBySubmission = new Map<string, Record<string, unknown>>();
  for (const a of answerRows) {
    const rec = answersBySubmission.get(a.submissionId) ?? {};
    rec[a.formFieldId] = parseSubmissionAnswerValue(a.valueJson, a.formFieldId);
    answersBySubmission.set(a.submissionId, rec);
  }

  const inputs: SubmissionExportInput[] = submissions.map((s) => {
    const speakers = speakersBySubmission.get(s.id) ?? [];
    return {
      ref: formatRef(recordPrefix, s.seq),
      title: s.title,
      status: s.status,
      contentStatus: s.contentStatus,
      tracks: [...(tracksBySubmission.get(s.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      speakers: speakers.map((sp) => sp.name),
      speakerEmails: speakers.map((sp) => sp.email),
      createdAt: s.createdAt.toISOString(),
      description: s.description ?? "",
      answers: answersBySubmission.get(s.id) ?? {},
    };
  });

  return shapeSubmissionsExport(inputs, customFields);
}
