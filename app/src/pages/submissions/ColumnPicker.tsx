import type { ColumnDef } from './columns';

interface ColumnPickerProps {
  columns: ColumnDef[];
  visibleFieldIds: ReadonlySet<string>;
  onToggle: (fieldId: string) => void;
}

export function ColumnPicker({ columns, visibleFieldIds, onToggle }: ColumnPickerProps) {
  if (columns.length === 0) return null;

  return (
    <details className="chq-column-picker">
      <summary>Columns</summary>
      <ul>
        {columns.map((col) => (
          <li key={col.fieldId}>
            <label>
              <input type="checkbox" checked={visibleFieldIds.has(col.fieldId)} onChange={() => onToggle(col.fieldId)} />
              {col.label}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
