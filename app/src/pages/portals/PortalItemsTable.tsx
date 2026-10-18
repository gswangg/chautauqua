// Portal editor · Items (Portals frame, flow 2): the library items this
// portal gives, each with this portal's own deadline (none, a fixed day, or
// N days after the participation joined), required flag and grace. The
// per-portal settings the frame doesn't draw -- a name shown only in this
// portal, edits after submitting, view-only once done -- and Remove sit in
// each row's Options disclosure.
import { useState } from 'react';
import { DateField } from '../../components/DateField';
import { EmptyState } from '../../components/EmptyState';
import { MAX_GRACE_DAYS, MAX_LIBRARY_TITLE, MAX_PORTAL_ITEMS, MAX_RELATIVE_DAYS } from '../../lib/domain-caps';
import { countOf } from '../../lib/plural';
import { itemAnchor, type DraftItem } from './portalDraft';
import type { DeadlineKind } from './types';

const GRACE_STEPS = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60];

const DEADLINE_LABELS: Record<DeadlineKind, string> = {
  none: 'No deadline',
  fixed: 'Fixed date',
  relative: 'After joining',
};

function graceOptions(current: number): number[] {
  const steps = GRACE_STEPS.filter((n) => n <= MAX_GRACE_DAYS);
  return steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
}

interface PortalItemsTableProps {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  onAdd: () => void;
  invalid: ReadonlySet<string>;
}

export function PortalItemsTable({ items, onChange, onAdd, invalid }: PortalItemsTableProps) {
  const [open, setOpen] = useState<string | null>(null);

  function update(key: string, patch: Partial<DraftItem>) {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function remove(key: string) {
    setOpen(null);
    onChange(items.filter((i) => i.key !== key));
  }

  return (
    <section className="chq-portal-section" aria-labelledby="portal-items-label">
      <div className="chq-section-head">
        <span className="chq-section-label" id="portal-items-label">
          Items · {items.length}
        </span>
        <button type="button" className="chq-link-button chq-portal-head-link" onClick={onAdd} disabled={items.length >= MAX_PORTAL_ITEMS}>
          Add from the library
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState variant="fresh" what="No items yet." reason="Participations this portal covers get nothing until it lists some." action={{ label: 'Add from the library', onClick: onAdd }} />
      ) : (
        <div className="chq-portal-items" role="table" aria-labelledby="portal-items-label">
          <div className="chq-portal-items-row chq-portal-items-head" role="row">
            <span role="columnheader">Item</span>
            <span role="columnheader">About</span>
            <span role="columnheader">Deadline</span>
            <span role="columnheader">Required</span>
            <span role="columnheader">Grace</span>
            <span role="columnheader" className="chq-portal-sr">
              Options
            </span>
          </div>
          {items.map((item) => {
            const expanded = open === item.key;
            const name = item.displayName.trim() !== '' ? item.displayName.trim() : item.title;
            const deadlineId = itemAnchor(item.key, 'deadline');
            const daysId = itemAnchor(item.key, 'days');
            const panelId = `portal-item-options-${item.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return (
              <div key={item.key} className="chq-portal-items-group" role="rowgroup">
                <div className="chq-portal-items-row" role="row">
                  <span role="cell" className="chq-portal-items-title">
                    <span className="chq-portal-items-name">{name}</span>
                    <span className="chq-portal-items-sub">
                      {name !== item.title ? `${item.title} in the library · ` : ''}
                      {item.libraryHint}
                    </span>
                  </span>
                  <span role="cell" className="chq-portal-items-about">
                    <span className="chq-portal-scope">{item.scope === 'participation' ? 'Participation' : 'Person'}</span>
                  </span>
                  <span role="cell" className="chq-portal-items-deadline">
                    <span className="chq-portal-items-cell-label" aria-hidden="true">
                      Deadline
                    </span>
                    <span className="chq-portal-items-deadline-controls">
                      <select
                        className="chq-select chq-portal-items-select"
                        aria-label={`Deadline for ${name}`}
                        value={item.deadlineKind}
                        onChange={(e) => update(item.key, { deadlineKind: e.target.value as DeadlineKind })}
                      >
                        {(['none', 'fixed', 'relative'] as const).map((k) => (
                          <option key={k} value={k}>
                            {DEADLINE_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      {item.deadlineKind === 'fixed' ? (
                        <label className="chq-portal-items-inline" data-invalid={invalid.has(deadlineId) ? 'true' : undefined}>
                          <span className="chq-portal-sr">Due date for {name}</span>
                          <DateField
                            id={deadlineId}
                            className="chq-input chq-portal-items-date"
                            value={item.dueDate}
                            onChange={(next) => update(item.key, { dueDate: next })}
                          />
                        </label>
                      ) : null}
                      {item.deadlineKind === 'relative' ? (
                        <span className="chq-portal-items-inline" data-invalid={invalid.has(daysId) ? 'true' : undefined}>
                          <input
                            id={daysId}
                            type="number"
                            className="chq-input chq-portal-items-days"
                            aria-label={`Days after joining for ${name}`}
                            min={0}
                            max={MAX_RELATIVE_DAYS}
                            value={item.relativeDays ?? ''}
                            onChange={(e) => {
                              const n = e.target.value === '' ? null : Math.max(0, Math.min(MAX_RELATIVE_DAYS, Math.round(Number(e.target.value))));
                              update(item.key, { relativeDays: n });
                            }}
                          />
                          <span className="chq-portal-items-unit" aria-hidden="true">
                            days
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span role="cell" className="chq-portal-items-required">
                    <span className="chq-portal-items-cell-label" aria-hidden="true">
                      Required
                    </span>
                    <select
                      className="chq-select chq-portal-items-select"
                      aria-label={`Required for ${name}`}
                      value={item.required ? 'yes' : 'no'}
                      onChange={(e) => update(item.key, { required: e.target.value === 'yes' })}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </span>
                  <span role="cell" className="chq-portal-items-grace">
                    <span className="chq-portal-items-cell-label" aria-hidden="true">
                      Grace
                    </span>
                    {item.deadlineKind === 'none' ? (
                      // grace counts from a deadline: with none it has nothing to extend
                      <select className="chq-select chq-portal-items-select" aria-label={`Grace for ${name}`} disabled value="none">
                        <option value="none">—</option>
                      </select>
                    ) : (
                      <select
                        className="chq-select chq-portal-items-select"
                        aria-label={`Grace for ${name}`}
                        value={item.graceDays}
                        onChange={(e) => update(item.key, { graceDays: Number(e.target.value) })}
                      >
                        {graceOptions(item.graceDays).map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? 'None' : countOf(n, 'day')}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                  <span role="cell" className="chq-portal-items-more">
                    <button
                      type="button"
                      className="chq-link-button chq-portal-items-toggle"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setOpen(expanded ? null : item.key)}
                    >
                      Options
                    </button>
                  </span>
                </div>
                {expanded ? (
                  <div className="chq-portal-items-options" id={panelId} role="row">
                    <span role="cell" className="chq-portal-items-options-body">
                      <span className="chq-portal-items-rename">
                        <label className="chq-portal-field-label" htmlFor={`${panelId}-name`}>
                          Name in this portal
                        </label>
                        <input
                          id={`${panelId}-name`}
                          className="chq-input"
                          value={item.displayName}
                          placeholder={item.title}
                          maxLength={MAX_LIBRARY_TITLE}
                          onChange={(e) => update(item.key, { displayName: e.target.value })}
                        />
                        <span className="chq-portal-field-help">Leave empty to use the library name. Other portals keep theirs.</span>
                      </span>
                      <span className="chq-portal-items-checks">
                        <label className="chq-checkbox-label">
                          <input
                            type="checkbox"
                            className="chq-check"
                            checked={item.allowEditAfterSubmit}
                            onChange={(e) => update(item.key, { allowEditAfterSubmit: e.target.checked })}
                          />
                          Allow edits after submitting
                        </label>
                        <label className="chq-checkbox-label">
                          <input
                            type="checkbox"
                            className="chq-check"
                            checked={item.viewOnlyWhenDone}
                            onChange={(e) => update(item.key, { viewOnlyWhenDone: e.target.checked })}
                          />
                          View only once done
                        </label>
                        {item.allowEditAfterSubmit && item.viewOnlyWhenDone ? (
                          <span className="chq-portal-field-help">With both on, view only wins: once done, it can't be edited.</span>
                        ) : null}
                      </span>
                      <button type="button" className="chq-btn chq-btn-destructive-tertiary chq-portal-items-remove" onClick={() => remove(item.key)}>
                        Remove from this portal
                      </button>
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
