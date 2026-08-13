import { describeCondition, fieldsByIdMap } from './condition';
import { kindLabel, type FormField } from './types';
// The FE form-builder module reads the SAME short-name test and length cap
// the API/pure core validate against (../../../../src/forms) so the
// builder's captions can never drift from the rule that actually enforces
// them -- e.g. the Abstract caption below always names the REAL
// MAX_LONG_TEXT_LENGTH, never a hand-copied number.
import { lockedFieldName } from '../../../../src/forms/types';
import { MAX_LONG_TEXT_LENGTH } from '../../../../src/forms/validate';

interface FieldListProps {
  fields: FormField[];
  busy: boolean;
  onEdit: (field: FormField) => void;
  onDelete: (field: FormField) => void;
  onMove: (field: FormField, direction: -1 | 1) => void;
}

// DEC-008/DEC-050: first_name/last_name/email are three separate locked
// FormField rows on the wire, but the mock renders them as a single quiet
// "Speaker name and email" row -- grouping is presentational only, it
// never touches field ids/positions/locked-field rules.
const SPEAKER_GROUP_NAMES = new Set(['first_name', 'last_name', 'email']);

// ONE named map (eval-findings item 51) for the remaining built-in
// captions -- 'description' is handled separately below (its caption
// names the REAL imported length cap, never a hardcoded number), and
// first_name/last_name/email collapse into the single speaker-group row
// above rather than appearing here.
const BUILT_IN_CAPTIONS: Record<string, string> = {
  title: 'Shown on every public page',
  job_title: "Shown on the speaker's public profile",
  company: "Shown on the speaker's public profile",
  bio: "Shown on the speaker's public profile",
};

interface DisplayRow {
  key: string;
  /** The field onEdit/onDelete/onMove act on; for the collapsed speaker
   * group this is the first (lowest-position) of the three grouped fields. */
  field: FormField;
  label: string;
  caption?: string;
  condition?: string;
  kindText: string;
  builtIn: boolean;
}

/** Projects the form's raw field list into the mock's row anatomy: the
 * three locked speaker-identity fields collapse into one "Speaker name and
 * email" row, 'description' renders as "Abstract" with the real imported
 * length cap, and the rest of the DEC-008 locked built-ins get a quiet
 * caption from BUILT_IN_CAPTIONS instead of a LOCKED pill. Every other
 * field (custom, non-locked) keeps its own label/kind/required and its
 * caption is its own helpText, per field, with the conditional-visibility
 * summary rendered as a second line when a rule exists. */
function buildRows(fields: FormField[]): DisplayRow[] {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const fieldsById = fieldsByIdMap(fields);
  const rows: DisplayRow[] = [];
  let speakerGroupRendered = false;

  for (const field of ordered) {
    const shortName = field.locked ? (lockedFieldName(field.id) ?? field.id) : null;

    if (shortName && SPEAKER_GROUP_NAMES.has(shortName)) {
      if (speakerGroupRendered) continue;
      speakerGroupRendered = true;
      rows.push({
        key: 'built-in-speaker-name-email',
        field,
        label: 'Speaker name and email',
        caption: 'Creates or matches a contact',
        kindText: 'Built in',
        builtIn: true,
      });
      continue;
    }

    if (shortName === 'description') {
      rows.push({
        key: field.id,
        field,
        label: 'Abstract',
        caption: `Up to ${MAX_LONG_TEXT_LENGTH} characters`,
        kindText: kindLabel(field.kind),
        builtIn: true,
      });
      continue;
    }

    if (shortName && BUILT_IN_CAPTIONS[shortName]) {
      rows.push({
        key: field.id,
        field,
        label: field.label,
        caption: BUILT_IN_CAPTIONS[shortName],
        kindText: kindLabel(field.kind),
        builtIn: true,
      });
      continue;
    }

    rows.push({
      key: field.id,
      field,
      label: field.label,
      caption: field.helpText,
      condition: field.rule ? describeCondition(field.rule, fieldsById) : undefined,
      kindText: kindLabel(field.kind),
      builtIn: field.locked,
    });
  }

  return rows;
}

/** Ordered field list for the form builder (eval-findings item 51 / DEC-715
 * row-anatomy rebuild): one-line rows -- handle, field name + one-line
 * caption, kind, REQUIRED/OPTIONAL, Edit/Delete inline at the right. The
 * drag handle is a real <button> (DEC-715): the ONE reorder affordance on
 * the row, operable by pointer (click focuses it) and keyboard
 * (ArrowUp/ArrowDown call the existing onMove(field, -1|1) contract) --
 * there are no separate up/down buttons. */
export function FieldList({ fields, busy, onEdit, onDelete, onMove }: FieldListProps) {
  const rows = buildRows(fields);

  return (
    <div className="chq-forms-field-list" role="list">
      {rows.map((row, index) => (
        <div
          key={row.key}
          role="listitem"
          className={row.builtIn ? 'chq-forms-field-row chq-forms-field-locked' : 'chq-forms-field-row'}
        >
          <button
            type="button"
            className="chq-forms-field-drag"
            aria-label={`Reorder ${row.label} (position ${index + 1} of ${rows.length})`}
            disabled={busy || row.field.locked}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(row.field, -1);
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(row.field, 1);
              }
            }}
          >
            ⋮⋮
          </button>

          <div className="chq-forms-field-label">
            <span className="chq-forms-field-label-text">{row.label}</span>
            {row.caption && <span className="chq-forms-field-help">{row.caption}</span>}
            {row.condition && <span className="chq-forms-field-condition">{row.condition}</span>}
          </div>

          <span className="chq-forms-field-kind">{row.kindText}</span>

          <span className={row.field.required ? 'chq-forms-field-required' : 'chq-forms-field-optional'}>
            {row.field.required ? 'Required' : 'Optional'}
          </span>

          <div className="chq-forms-field-actions">
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={busy || row.field.locked}
              onClick={() => onEdit(row.field)}
            >
              Edit
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={busy || row.field.locked}
              onClick={() => onDelete(row.field)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
