// Pure mapping helpers for SubmissionDetailPage (DEC-045): turn the
// SubmissionDetail.answers record (keyed by form_field id) into
// display-ready rows labeled via the event's CFP form fields. Locked
// built-in fields (title/description/...) never appear here — they arrive
// as real SubmissionDetail columns per DEC-016, not in `answers`.
import { formatAnswerValue } from './columns';
import type { FormField } from './types';

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
 */
export function buildAnswerRows(answers: Record<string, unknown>, fields: FormField[]): AnswerRow[] {
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  return Object.entries(answers)
    .map(([fieldId, value]) => {
      const field = fieldById.get(fieldId);
      return {
        fieldId,
        label: field?.label ?? fieldId,
        displayValue: formatAnswerValue(value),
        position: field?.position ?? Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.fieldId.localeCompare(b.fieldId);
    })
    .map(({ fieldId, label, displayValue }) => ({ fieldId, label, displayValue }));
}
