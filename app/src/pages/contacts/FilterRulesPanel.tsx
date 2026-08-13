// DEC-787: restores the multi-facet contact filter (deleted by DEC-712/
// eval-findings 45+55 as part of the ContactsTable redesign) as its own
// component, wired above the directory table rather than inside it. Emits
// SegmentRule[] (AND-composed) that ContactsApp already threads onto GET
// /contacts?rules= and contactsExportHref — so the table, the count and the
// CSV all follow for free (no new plumbing here).
//
// The field vocabulary is imported from src/domain/contacts.ts's
// SEGMENT_STANDARD_FIELDS -- the SAME set GET /contacts validates ?rules=
// against -- rather than re-declared, so the picker can never drift ahead
// of what the server accepts. custom.<key> fields are addressed by typing
// the key: no server-side enumeration of a org's contact custom-field keys
// exists to populate a dropdown from.
import { useState } from 'react';
import type { SegmentRule } from './types';
import { describeRules } from './segments';
import { SEGMENT_STANDARD_FIELDS } from '../../../../src/domain/contacts';

export const FILTER_RULE_FIELDS: string[] = [...SEGMENT_STANDARD_FIELDS];

const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  title: 'Title',
};

const OP_OPTIONS: { value: SegmentRule['op']; label: string }[] = [
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
  { value: 'contains', label: 'contains' },
];

const CUSTOM_FIELD_CHOICE = 'custom';

interface Props {
  rules: SegmentRule[];
  onChange: (rules: SegmentRule[]) => void;
}

export function FilterRulesPanel({ rules, onChange }: Props) {
  const [draftField, setDraftField] = useState<string>(FILTER_RULE_FIELDS[0]!);
  const [draftCustomKey, setDraftCustomKey] = useState('');
  const [draftOp, setDraftOp] = useState<SegmentRule['op']>('contains');
  const [draftValue, setDraftValue] = useState('');

  const isCustom = draftField === CUSTOM_FIELD_CHOICE;
  const trimmedKey = draftCustomKey.trim();
  const trimmedValue = draftValue.trim();
  const resolvedField = isCustom ? `custom.${trimmedKey}` : draftField;
  const canAdd = trimmedValue !== '' && (!isCustom || trimmedKey !== '');

  function addRule() {
    if (!canAdd) return;
    onChange([...rules, { field: resolvedField, op: draftOp, value: trimmedValue }]);
    setDraftValue('');
    setDraftCustomKey('');
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  return (
    <div className="chq-contacts-filter-rules">
      {rules.length > 0 && (
        <ul className="chq-contacts-filter-rule-chips chq-chipstrip">
          {rules.map((r, i) => (
            <li key={`${r.field}-${r.op}-${r.value}-${i}`} className="chq-contacts-filter-rule-chip chq-pill">
              {describeRules([r])}
              <button
                type="button"
                className="chq-contacts-filter-rule-remove"
                aria-label={`Remove filter ${describeRules([r])}`}
                onClick={() => removeRule(i)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="chq-contacts-filter-rules-row">
        <label className="chq-contacts-filter-rules-field">
          Field
          <select
            className="chq-select"
            aria-label="Filter field"
            value={draftField}
            onChange={(e) => setDraftField(e.target.value)}
          >
            {FILTER_RULE_FIELDS.map((f) => (
              <option key={f} value={f}>
                {FIELD_LABELS[f] ?? f}
              </option>
            ))}
            <option value={CUSTOM_FIELD_CHOICE}>Custom field…</option>
          </select>
        </label>

        {isCustom && (
          <label className="chq-contacts-filter-rules-field">
            Custom key
            <input
              className="chq-input"
              aria-label="Custom field key"
              value={draftCustomKey}
              onChange={(e) => setDraftCustomKey(e.target.value)}
            />
          </label>
        )}

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

        <button type="button" className="chq-btn chq-btn-secondary" onClick={addRule} disabled={!canAdd}>
          Add filter
        </button>
      </div>
    </div>
  );
}
