// Pure mapping helpers for SubmissionDetailPage (DEC-045): turn the
// SubmissionDetail.answers record (keyed by form_field id) into
// display-ready rows labeled via the event's CFP form fields. Locked
// built-in fields (title/description/...) never appear here — they arrive
// as real SubmissionDetail columns per DEC-016, not in `answers`.
import { answerDisplayText } from '../../../../src/domain/answer-text';
import type { FormField } from './types';
// DEC-908: the ONE test for "is this answer key a locked built-in field" --
// never a new hand-written id list beside this one.
import { lockedFieldName } from '../../../../src/forms/types';

export interface CfpFormLike {
  id: string;
  fields: FormField[];
}

export interface AnswerFileLink {
  href: string;
  filename: string;
  sizeBytes: number;
}

export interface AnswerRow {
  fieldId: string;
  label: string;
  displayValue: string;
  // DEC-920: present only for a 'file'-kind field whose stored answer id
  // resolves against SubmissionDetail.answerFiles. When absent, the row
  // renders displayValue as plain text (unchanged for every other kind);
  // an unresolvable file id renders displayValue === 'File removed' with
  // file left undefined — never the bare id.
  file?: AnswerFileLink;
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
export function buildAnswerRows(
  answers: Record<string, unknown>,
  fields: FormField[],
  answerFiles: { id: string; filename: string; sizeBytes: number }[] = [],
): AnswerRow[] {
  const EM_DASH = '—';
  const FILE_REMOVED = 'File removed';
  const matchedFieldIds = new Set<string>();
  const filesById = new Map(answerFiles.map((f) => [f.id, f]));

  const fieldRows = fields
    .filter((field) => lockedFieldName(field.id) === null)
    .sort((a, b) => a.position - b.position)
    .map((field) => {
      matchedFieldIds.add(field.id);
      const hasAnswer = Object.prototype.hasOwnProperty.call(answers, field.id);

      // DEC-920: a 'file'-kind answer stores an opaque file id (DEC-040) --
      // resolve it against answerFiles instead of the generic formatter, so
      // the organizer sees a filename/link, never the raw id.
      if (field.kind === 'file') {
        if (!hasAnswer) {
          return { fieldId: field.id, label: field.label, displayValue: EM_DASH };
        }
        const rawId = answers[field.id];
        const resolved = typeof rawId === 'string' ? filesById.get(rawId) : undefined;
        if (!resolved) {
          return { fieldId: field.id, label: field.label, displayValue: FILE_REMOVED };
        }
        return {
          fieldId: field.id,
          label: field.label,
          displayValue: resolved.filename,
          file: { href: `/files/${resolved.id}`, filename: resolved.filename, sizeBytes: resolved.sizeBytes },
        };
      }

      const displayValue = hasAnswer ? answerDisplayText(answers[field.id]) : '';
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
      displayValue: answerDisplayText(value),
    }))
    .filter((row) => row.displayValue.trim() !== '')
    .sort((a, b) => a.fieldId.localeCompare(b.fieldId));

  return [...fieldRows, ...orphanRows];
}

// DEC-828: the placement line itself lives in ./schedule.ts (formatSubmissionScheduleLine)
// so it can reuse the app's shared day-label formatter (dates.ts) instead of a
// second hand-rolled day formatter living beside the answers-row mapping helpers here.
