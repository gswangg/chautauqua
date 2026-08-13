// Pure mapping helpers for SubmissionDetailPage (DEC-045): turn the
// SubmissionDetail.answers record (keyed by form_field id) into
// display-ready rows labeled via the event's CFP form fields. Locked
// built-in fields (title/description/...) never appear here — they arrive
// as real SubmissionDetail columns per DEC-016, not in `answers`.
import { formatAnswerValue } from './columns';
import type { FormField } from './types';
// DEC-908: the ONE test for "is this answer key a locked built-in field" --
// never a new hand-written id list beside this one.
import { lockedFieldName } from '../../../../src/forms/types';

export interface CfpFormLike {
  id: string;
  fields: FormField[];
}

export interface AnswerRow {
  fieldId: string;
  label: string;
  displayValue: string;
}

/**
 * Resolve the field list to use for labeling a submission's answers. The
 * event's default CFP form is only meaningful if it's the exact form the
 * submission was submitted against (detail.formId) — otherwise there's no
 * reliable label source and every answer falls back to its raw key.
 */
export function resolveAnswerFields(form: CfpFormLike | null, formId: string | null): FormField[] {
  if (!form || !formId || form.id !== formId) return [];
  return form.fields;
}

/**
 * Build labeled rows for a submission's dynamic answers, sorted by the
 * matching field's position (author-defined order); answers with no
 * matching field (fall back to the raw key) sort after all matched ones,
 * in raw key order.
 *
 * DEC-908: two exclusions before display. (1) An answer whose fieldId
 * resolves to a locked built-in field (title/description/first name/last
 * name/email/...) is skipped -- locked fields already have their own
 * dedicated SubmissionDetail columns (DEC-016) and must never double-render
 * as a Form Answers row, even if a stray one somehow lands in `answers`.
 * The check goes through the SAME lockedFieldName helper the builder uses,
 * never a second hand-written list. (2) An answer whose formatted value is
 * empty/whitespace-only is skipped -- an unanswered optional field is not a
 * fact worth a row.
 */
export function buildAnswerRows(answers: Record<string, unknown>, fields: FormField[]): AnswerRow[] {
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  return Object.entries(answers)
    .filter(([fieldId]) => lockedFieldName(fieldId) === null)
    .map(([fieldId, value]) => {
      const field = fieldById.get(fieldId);
      return {
        fieldId,
        label: field?.label ?? fieldId,
        displayValue: formatAnswerValue(value),
        position: field?.position ?? Number.POSITIVE_INFINITY,
      };
    })
    .filter((row) => row.displayValue.trim() !== '')
    .sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.fieldId.localeCompare(b.fieldId);
    })
    .map(({ fieldId, label, displayValue }) => ({ fieldId, label, displayValue }));
}

// DEC-828: the placement line itself lives in ./schedule.ts (formatSubmissionScheduleLine)
// so it can reuse the app's shared day-label formatter (dates.ts) instead of a
// second hand-rolled day formatter living beside the answers-row mapping helpers here.
