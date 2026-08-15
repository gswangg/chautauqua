import type { FormField } from './types';

export interface ColumnDef {
  fieldId: string;
  label: string;
  section: 'session' | 'speaker';
  kind: FormField['kind'];
}

/**
 * Derive the dynamic custom-answer columns available for the submissions
 * table from a form's field list. GET /api/v1/events/:eventId/forms returns
 * only custom (non-locked) fields — locked built-ins (title, description,
 * speaker name/email) already have their own dedicated table columns and
 * live on real submission/contact columns per DEC-016, not in submission_answer
 * — so every field here is a genuine toggleable custom column.
 * Sorted by the form's own field.position (author-defined order).
 */
export function deriveColumnsFromFormFields(fields: FormField[]): ColumnDef[] {
  return [...fields]
    .sort((a, b) => a.position - b.position)
    .map((field) => ({
      fieldId: field.id,
      label: field.label,
      section: field.section,
      kind: field.kind,
    }));
}

/**
 * Given the full derived column list and a set of visible field ids, return
 * columns in derived order filtered to those toggled on. `visible === null`
 * means "no picker state yet" -> show none until the caller initializes it.
 */
export function visibleColumns(columns: ColumnDef[], visibleFieldIds: ReadonlySet<string>): ColumnDef[] {
  return columns.filter((col) => visibleFieldIds.has(col.fieldId));
}

/**
 * DEC-243 (amended by DEC-249): the CFP form's Format field (a dropdown
 * e.g. Talk/Workshop/Panel) should be visible in the submissions table by
 * default, out of the box, without the organizer having to open the column
 * picker. DEC-249 widens the label match to an allowlist since fixture forms
 * label the field "Session format" rather than plain "Format". Matches are
 * exact (after trim + lowercase) against FORMAT_LABELS -- no substring or
 * fuzzy matching -- so forms that don't define such a field simply have
 * nothing to default-show.
 */
const FORMAT_LABELS = new Set(['format', 'session format']);

export function findFormatField(fields: FormField[]): FormField | undefined {
  return fields.find((field) => field.kind === 'dropdown' && FORMAT_LABELS.has(field.label.trim().toLowerCase()));
}
