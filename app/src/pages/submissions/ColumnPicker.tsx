import type { ColumnDef } from './columns';

interface ColumnPickerProps {
  columns: ColumnDef[];
  visibleFieldIds: ReadonlySet<string>;
  onToggle: (fieldId: string) => void;
}

// DEC-752: "Columns: Format" when exactly one custom column is visible
// (echoing the column's own label), else a count -- "Columns" alone with
// zero shown gives no signal that the toggle exists to add more.
function columnsSummary(columns: ColumnDef[], visibleFieldIds: ReadonlySet<string>): string {
  const visible = columns.filter((col) => visibleFieldIds.has(col.fieldId));
  const only = visible[0];
  if (visible.length === 1 && only !== undefined) {
    const label = only.label.trim();
    return `Columns: ${label.length === 0 ? only.fieldId : label}`;
  }
  return `Columns: ${visible.length}`;
}

export function ColumnPicker({ columns, visibleFieldIds, onToggle }: ColumnPickerProps) {
  if (columns.length === 0) return null;

  return (
    <details className="chq-submissions-columnpicker">
      <summary>{columnsSummary(columns, visibleFieldIds)}</summary>
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
