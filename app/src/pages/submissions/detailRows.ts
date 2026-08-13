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
 * Build labeled rows for a submission's dynamic answers.
 *
 * DEC-908 (amended): FORM ANSWERS enumerates `fields`, not `answers` --
 * every non-locked form field gets a row, in the form's author-defined
 * position order, whether or not the submitter answered it. A field with
 * no stored answer (or an empty/whitespace-only one) renders with an em
 * dash rather than vanishing, so an unanswered optional question (e.g.
 * "Accessibility needs") still reads as a real, unanswered question. Locked
 * built-in fields (title/description/first name/last name/email/...) are
 * skipped -- they already have their own dedicated SubmissionDetail columns
 * (DEC-016) and must never double-render as a Form Answers row. The check
 * goes through the SAME lockedFieldName helper the builder uses, never a
 * second hand-written list.
 *
 * After every form field has produced a row, any answer key that matches no
 * field (a stray/orphaned answer -- e.g. from a field since deleted from the
 * form) still gets a row, appended in raw key order, exactly as before.
 */
export function buildAnswerRows(answers: Record<string, unknown>, fields: FormField[]): AnswerRow[] {
  const EM_DASH = '—';
  const matchedFieldIds = new Set<string>();

  const fieldRows = fields
    .filter((field) => lockedFieldName(field.id) === null)
    .sort((a, b) => a.position - b.position)
    .map((field) => {
      matchedFieldIds.add(field.id);
      const hasAnswer = Object.prototype.hasOwnProperty.call(answers, field.id);
      const displayValue = hasAnswer ? formatAnswerValue(answers[field.id]) : '';
      return {
        fieldId: field.id,
        label: field.label,
        displayValue: displayValue.trim() === '' ? EM_DASH : displayValue,
      };
    });

  const orphanRows = Object.entries(answers)
    .filter(([fieldId]) => !matchedFieldIds.has(fieldId) && lockedFieldName(fieldId) === null)
    .map(([fieldId, value]) => ({
      fieldId,
      label: fieldId,
      displayValue: formatAnswerValue(value),
    }))
    .filter((row) => row.displayValue.trim() !== '')
    .sort((a, b) => a.fieldId.localeCompare(b.fieldId));

  return [...fieldRows, ...orphanRows];
}

// DEC-828: the placement line itself lives in ./schedule.ts (formatSubmissionScheduleLine)
// so it can reuse the app's shared day-label formatter (dates.ts) instead of a
// second hand-rolled day formatter living beside the answers-row mapping helpers here.
