// DEC-993: "Merge fields are a dropdown" — replaces the old row of one
// chip-button per merge field with a single 'Insert a field ▾' trigger.
// Adopts the shared useMenu primitive (app/src/lib/useMenu.ts) so Escape,
// outside-click and arrow-key navigation match every other menu in the
// product (a role="menu" with only Escape is a list of buttons).
import { useState } from 'react';
import { useMenu } from '../../lib/useMenu';
import { MERGE_FIELD_SAMPLES, type MergeField } from '../../lib/merge-fields';
import { DEC_993 } from '../../../../src/decisions';

// Compile-checked dependency marker (DEC-993).
void DEC_993;

interface InsertFieldMenuProps {
  fields: readonly MergeField[];
  onInsert: (field: MergeField) => void;
  label?: string;
}

export function InsertFieldMenu({ fields, onInsert, label }: InsertFieldMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { containerRef, onPanelKeyDown } = useMenu(open, close);
  const triggerLabel = label ?? 'Insert a field';

  return (
    <div className="chq-insert-field-menu" ref={containerRef}>
      <button
        type="button"
        className="chq-btn chq-btn-secondary chq-btn-small chq-insert-field-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel} <span aria-hidden="true">▾</span>
      </button>
      {/* The count is computed from the SAME `fields` list the panel below
          renders — never a hardcoded numeral — so growing/shrinking the
          vocabulary can never desync the sentence from the options. */}
      <p className="chq-insert-field-menu-hint">
        {fields.length} available &middot; dropped in at the cursor
      </p>

      {open && (
        <div
          className="chq-insert-field-menu-panel"
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onPanelKeyDown}
        >
          {fields.map((field) => (
            <button
              key={field}
              type="button"
              role="menuitem"
              aria-label={`{${field}}`}
              className="chq-insert-field-menu-item"
              onClick={() => {
                close();
                onInsert(field);
              }}
            >
              <span className="chq-insert-field-menu-item-token" aria-hidden="true">{`{${field}}`}</span>
              <span className="chq-insert-field-menu-item-sample">{MERGE_FIELD_SAMPLES[field]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
