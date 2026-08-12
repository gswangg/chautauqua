import type { ColumnDef } from './columns';

interface ColumnPickerProps {
  columns: ColumnDef[];
  visibleFieldIds: ReadonlySet<string>;
  onToggle: (fieldId: string) => void;
}

export function ColumnPicker({ columns, visibleFieldIds, onToggle }: ColumnPickerProps) {
  if (columns.length === 0) return null;

  return (
    <details className="chq-submissions-columnpicker">
      <summary>Columns</summary>
      <fieldset className="chq-submissions-columnpicker-panel">
        <legend>Columns</legend>
        <ul>
          {columns.map((col) => {
            const label = col.label.trim();
            return (
              <li key={col.fieldId}>
                <label>
                  <input
                    type="checkbox"
                    className="chq-check"
                    checked={visibleFieldIds.has(col.fieldId)}
                    onChange={() => onToggle(col.fieldId)}
                    aria-label={label.length === 0 ? `Toggle column ${col.fieldId}` : undefined}
                  />
                  {label.length === 0 ? ' ' : label}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </details>
  );
}
