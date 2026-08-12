import { describeCondition, fieldsByIdMap } from './condition';
import { kindLabel, type FormField } from './types';

interface FieldListProps {
  fields: FormField[];
  busy: boolean;
  onEdit: (field: FormField) => void;
  onDelete: (field: FormField) => void;
  onMove: (field: FormField, direction: -1 | 1) => void;
}

/** Ordered field list for the form builder (DEC-650 mock: flat rows, not a
 * table). Locked DEC-016 built-ins render a lock marker and disable
 * edit/remove/reorder controls. The leading ⋮⋮ glyph is the reorder
 * affordance (DEC-367: no icons/images/SVG); actual reordering still
 * happens through the accessible up/down buttons — no pointer-drag was
 * added, keeping the DEC-016 fields/reorder contract and DEC-368
 * no-new-deps rule untouched. */
export function FieldList({ fields, busy, onEdit, onDelete, onMove }: FieldListProps) {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const fieldsById = fieldsByIdMap(fields);

  return (
    <div className="chq-forms-field-list" role="list">
      {ordered.map((field, index) => (
        <div
          key={field.id}
          role="listitem"
          className={field.locked ? 'chq-forms-field-row chq-forms-field-locked' : 'chq-forms-field-row'}
        >
          <span className="chq-forms-field-drag" aria-hidden="true">
            ⋮⋮
          </span>

          <div className="chq-forms-field-label">
            <span className="chq-forms-field-label-text">
              {field.locked && (
                <span className="chq-forms-field-locked-tag" aria-label="Locked built-in field" title="Locked built-in field">
                  Locked
                </span>
              )}
              {field.label}
            </span>
            {field.helpText && <span className="chq-forms-field-help">{field.helpText}</span>}
            {field.rule && <span className="chq-forms-field-condition">{describeCondition(field.rule, fieldsById)}</span>}
          </div>

          <span className="chq-forms-field-kind">{kindLabel(field.kind)}</span>

          <span className={field.required ? 'chq-forms-field-required' : 'chq-forms-field-optional'}>
            {field.required ? 'Required' : 'Optional'}
          </span>

          <div className="chq-forms-field-move">
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              aria-label={`Move ${field.label} up`}
              disabled={busy || field.locked || index === 0}
              onClick={() => onMove(field, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              aria-label={`Move ${field.label} down`}
              disabled={busy || field.locked || index === ordered.length - 1}
              onClick={() => onMove(field, 1)}
            >
              ↓
            </button>
          </div>

          <div className="chq-forms-field-actions">
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={busy || field.locked}
              onClick={() => onEdit(field)}
            >
              Edit
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              disabled={busy || field.locked}
              onClick={() => onDelete(field)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
