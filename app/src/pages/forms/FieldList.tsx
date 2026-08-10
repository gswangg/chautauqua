import { kindLabel, type FormField } from './types';

interface FieldListProps {
  fields: FormField[];
  busy: boolean;
  onEdit: (field: FormField) => void;
  onDelete: (field: FormField) => void;
  onMove: (field: FormField, direction: -1 | 1) => void;
}

/** Ordered field list for the form builder. Locked DEC-016 built-ins render
 * a lock marker and disable edit/remove/reorder controls. */
export function FieldList({ fields, busy, onEdit, onDelete, onMove }: FieldListProps) {
  const ordered = [...fields].sort((a, b) => a.position - b.position);

  return (
    <table className="chq-table chq-forms-field-list">
      <thead>
        <tr>
          <th>Order</th>
          <th>Label</th>
          <th>Section</th>
          <th>Kind</th>
          <th>Required</th>
          <th>Condition</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((field, index) => (
          <tr key={field.id} className={field.locked ? 'chq-forms-field-locked' : undefined}>
            <td>
              <button
                type="button"
                aria-label={`Move ${field.label} up`}
                disabled={busy || field.locked || index === 0}
                onClick={() => onMove(field, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${field.label} down`}
                disabled={busy || field.locked || index === ordered.length - 1}
                onClick={() => onMove(field, 1)}
              >
                ↓
              </button>
            </td>
            <td>
              {field.locked && <span aria-label="Locked built-in field" title="Locked built-in field">🔒 </span>}
              {field.label}
            </td>
            <td>{field.section}</td>
            <td>{kindLabel(field.kind)}</td>
            <td>{field.required ? 'Yes' : 'No'}</td>
            <td>{field.rule ? `if ${field.rule.fieldId} ${field.rule.op} ${JSON.stringify(field.rule.value)}` : '—'}</td>
            <td>
              <button type="button" disabled={busy || field.locked} onClick={() => onEdit(field)}>
                Edit
              </button>
              <button type="button" disabled={busy || field.locked} onClick={() => onDelete(field)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
