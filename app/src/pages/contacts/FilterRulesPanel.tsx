import { useState } from 'react';
import type { SegmentRule } from './types';
import './contacts-panels.css';

// Multi-criteria filter builder (CRM-02, DEC-149). Emits SegmentRule[]
// (AND-composed, field 'any' fans out across email/firstName/lastName/
// company/title) that ContactsApp threads onto GET /contacts?rules= and
// that SegmentsPanel persists verbatim on "save as segment" — so reopening
// a saved segment reproduces exactly the filtered result set (no lossy
// approximation, unlike the old free-text-only q). Behaviour frozen
// (DEC-366): the rule shape and 'any' matcher are untouched by this
// redesign (w2-e).

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'any', label: 'Any field' },
  { value: 'email', label: 'Email' },
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Title' },
];

const OP_OPTIONS: { value: SegmentRule['op']; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
];

const OP_LABEL: Record<SegmentRule['op'], string> = { contains: 'contains', eq: 'is', ne: 'is not' };

interface Props {
  rules: SegmentRule[];
  onChange: (rules: SegmentRule[]) => void;
}

export function FilterRulesPanel({ rules, onChange }: Props) {
  const [draftField, setDraftField] = useState<string>('any');
  const [draftOp, setDraftOp] = useState<SegmentRule['op']>('contains');
  const [draftValue, setDraftValue] = useState('');

  function addRule() {
    const value = draftValue.trim();
    if (value === '') return;
    onChange([...rules, { field: draftField, op: draftOp, value }]);
    setDraftValue('');
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="chq-contacts-filter-rules">
      <div className="chq-contacts-filter-rules-row">
        <label className="chq-contacts-filter-rules-field">
          Field
          <select
            className="chq-select"
            aria-label="Filter field"
            value={draftField}
            onChange={(e) => setDraftField(e.target.value)}
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="chq-contacts-filter-rules-field">
          Operator
          <select
            className="chq-select"
            aria-label="Filter operator"
            value={draftOp}
            onChange={(e) => setDraftOp(e.target.value as SegmentRule['op'])}
          >
            {OP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="chq-contacts-filter-rules-field">
          Value
          <input
            className="chq-input"
            aria-label="Filter value"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
          />
        </label>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={addRule} disabled={draftValue.trim() === ''}>
          Add filter
        </button>
        {rules.length > 0 && (
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {rules.length > 0 && (
        <ul className="chq-contacts-filter-rule-chips">
          {rules.map((r, i) => (
            <li key={`${r.field}-${r.op}-${r.value}-${i}`} className="chq-contacts-filter-rule-chip">
              {r.field} {OP_LABEL[r.op]} &quot;{r.value}&quot;
              <button
                type="button"
                className="chq-link-button"
                aria-label={`Remove filter ${i + 1}`}
                onClick={() => removeRule(i)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
