import { useState, type DragEvent } from 'react';
import { describeCondition, fieldsByIdMap } from './condition';
import { kindLabel, type FormField } from './types';
// The FE form-builder module reads the SAME short-name test and length cap
// the API/pure core validate against (../../../../src/forms) so the
// builder's captions can never drift from the rule that actually enforces
// them -- e.g. the Abstract caption below always names the REAL
// MAX_LONG_TEXT_LENGTH, never a hand-copied number.
import { lockedFieldName, SESSION_FORMAT_FIELD_ID } from '../../../../src/forms/types';
import { MAX_LONG_TEXT_LENGTH } from '../../../../src/forms/validate';
import { countOf } from '../../lib/plural';

// DEC-592/DEC-762: the ONE id for the seeded session-format field is the
// SAME id the API/seed use, so the builder's "Format" display label is
// derived from that id once here rather than sprinkled per label string.
const DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
  [SESSION_FORMAT_FIELD_ID]: 'Format',
};

/** Thousands-grouped integer, e.g. 20000 -> "20,000". A plain regex rather
 * than toLocaleString/Intl (banned outside lib/dates.ts, DEC-963) -- this
 * is a character-count grouping, not a locale-sensitive date/number. */
function formatThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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

/** Kinds whose caption, when the field has no helpText of its own, states
 * how many options the field offers -- built from the field's own `options`
 * array (never a hand-maintained label), so it can never drift from the
 * options the field actually stores. */
const OPTION_COUNT_KINDS = new Set(['dropdown', 'checkbox']);

function optionCountCaption(field: FormField): string | undefined {
  if (!OPTION_COUNT_KINDS.has(field.kind)) return undefined;
  const count = field.options?.length ?? 0;
  return countOf(count, 'option');
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
        caption: `Up to ${formatThousands(MAX_LONG_TEXT_LENGTH)} characters`,
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
      label: DISPLAY_LABEL_OVERRIDES[field.id] ?? field.label,
      caption: field.helpText || optionCountCaption(field),
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
  // The row currently under a dragged field (DEC-903 visible insertion
  // point) -- cleared on drop/leave, never persisted past the drag gesture.
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Drag-drop reorder (same contract as DayGrid.tsx): dragstart stamps the
  // dragged field's id on text/plain, dragover marks a valid drop target,
  // drop reads the id back, finds both rows' indices, and calls the SAME
  // onMove(field, delta) the keyboard path already uses -- one reorder write
  // path, so the optimistic update/rollback in FormsPage stays written once.
  function handleDragStart(event: DragEvent, row: DisplayRow) {
    if (busy || row.field.locked) return;
    event.dataTransfer.setData('text/plain', row.field.id);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event: DragEvent, row: DisplayRow) {
    if (busy || row.field.locked) return;
    event.preventDefault();
    if (dragOverKey !== row.key) setDragOverKey(row.key);
  }

  function handleDragLeave(row: DisplayRow) {
    setDragOverKey((current) => (current === row.key ? null : current));
  }

  function handleDrop(event: DragEvent, targetRow: DisplayRow, targetIndex: number) {
    setDragOverKey(null);
    if (busy || targetRow.field.locked) return;
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const sourceIndex = rows.findIndex((r) => r.field.id === draggedId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const sourceRow = rows[sourceIndex]!;
    const delta = targetIndex - sourceIndex;
    onMove(sourceRow.field, delta > 0 ? 1 : -1);
  }

  return (
    <div className="chq-forms-field-list" role="list">
      {rows.map((row, index) => (
        <div
          key={row.key}
          role="listitem"
          className={[
            'chq-forms-field-row',
            row.builtIn ? 'chq-forms-field-locked' : null,
            dragOverKey === row.key ? 'chq-forms-field-row-drop-target' : null,
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={(event) => handleDragOver(event, row)}
          onDragLeave={() => handleDragLeave(row)}
          onDrop={(event) => handleDrop(event, row, index)}
        >
          <button
            type="button"
            className="chq-forms-field-drag"
            aria-label={`Reorder ${row.label} (position ${index + 1} of ${rows.length})`}
            disabled={busy || row.field.locked}
            draggable={!(busy || row.field.locked)}
            onDragStart={(event) => handleDragStart(event, row)}
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
