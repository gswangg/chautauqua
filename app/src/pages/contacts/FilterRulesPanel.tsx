// DEC-787/DEC-868: restores the multi-facet contact filter (deleted by
// DEC-712/eval-findings 45+55 as part of the ContactsTable redesign) as its
// own component, wired above the directory table rather than inside it. It
// renders ONE row — "Matching all of" the AND — with one editable group per
// rule, an "Add a rule" button, and (only once a rule is active) the match
// count and "Save as a segment" at the row's end, per the design pack's
// grammar (docs/design/README.md:293-301). Emits SegmentRule[] (AND-composed)
// that ContactsApp already threads onto GET /contacts?rules= and
// contactsExportHref (through activeRules() — see segments.ts) — so the
// table, the count and the CSV all follow for free (no new plumbing here).
//
// The field vocabulary is imported from src/domain/contacts.ts's
// SEGMENT_STANDARD_FIELDS -- the SAME set GET /contacts validates ?rules=
// against -- rather than re-declared, so the picker can never drift ahead
// of what the server accepts. custom.<key> fields are addressed by typing
// the key: no server-side enumeration of a org's contact custom-field keys
// exists to populate a dropdown from.
import { activeRules } from './segments';
import type { SegmentRule } from './types';
import { SEGMENT_STANDARD_FIELDS } from '../../../../src/domain/contacts';
import { MAX_SEGMENT_RULES } from '../../lib/domain-caps';
import { DEC_868 } from '../../../../src/decisions';

void DEC_868;

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

function isCustomField(field: string): boolean {
  return field === CUSTOM_FIELD_CHOICE || field.startsWith('custom.');
}

function customKeyOf(field: string): string {
  return field.startsWith('custom.') ? field.slice('custom.'.length) : '';
}

interface Props {
  rules: SegmentRule[];
  onChange: (rules: SegmentRule[]) => void;
  matchCount: number;
  totalCount: number | null;
  onSaveAsSegment: () => void;
}

export function FilterRulesPanel({ rules, onChange, matchCount, totalCount, onSaveAsSegment }: Props) {
  function updateRule(index: number, next: SegmentRule) {
    onChange(rules.map((r, i) => (i === index ? next : r)));
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function addRule() {
    onChange([...rules, { field: FILTER_RULE_FIELDS[0]!, op: 'contains', value: '' }]);
  }

  return (
    <div className="chq-contacts-filter-rules-row">
      <span className="chq-contacts-filter-rules-caption">Matching all of</span>

      {rules.map((rule, i) => {
        const pos = i + 1;
        const custom = isCustomField(rule.field);
        const fieldSelectValue = custom ? CUSTOM_FIELD_CHOICE : rule.field;
        const customKey = customKeyOf(rule.field);

        return (
          <span className="chq-contacts-filter-rule-group" key={i}>
            <select
              className="chq-select"
              aria-label={`Filter ${pos} field`}
              value={fieldSelectValue}
              onChange={(e) => {
                const nextField = e.target.value;
                if (nextField === CUSTOM_FIELD_CHOICE) {
                  updateRule(i, { ...rule, field: 'custom.' });
                } else {
                  updateRule(i, { ...rule, field: nextField });
                }
              }}
            >
              {FILTER_RULE_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABELS[f] ?? f}
                </option>
              ))}
              <option value={CUSTOM_FIELD_CHOICE}>Custom field…</option>
            </select>

            {custom && (
              <input
                className="chq-input"
                aria-label={`Filter ${pos} custom field key`}
                value={customKey}
                onChange={(e) => updateRule(i, { ...rule, field: `custom.${e.target.value}` })}
              />
            )}

            <select
              className="chq-select"
              aria-label={`Filter ${pos} operator`}
              value={rule.op}
              onChange={(e) => updateRule(i, { ...rule, op: e.target.value as SegmentRule['op'] })}
            >
              {OP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <input
              className="chq-input"
              aria-label={`Filter ${pos} value`}
              value={rule.value}
              onChange={(e) => updateRule(i, { ...rule, value: e.target.value })}
            />

            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              aria-label={`Remove filter ${pos}`}
              onClick={() => removeRule(i)}
            >
              Remove
            </button>
          </span>
        );
      })}

      <button
        type="button"
        className="chq-btn chq-btn-tertiary"
        onClick={addRule}
        disabled={rules.length >= MAX_SEGMENT_RULES}
      >
        Add a rule
      </button>
      {rules.length >= MAX_SEGMENT_RULES && (
        <span className="chq-meta chq-contacts-filter-rules-cap">
          Up to {MAX_SEGMENT_RULES} rules.
        </span>
      )}

      {activeRules(rules).length > 0 && (
        <span className="chq-contacts-filter-rules-end">
          <span className="chq-contacts-filter-match-count">
            {totalCount === null ? `${matchCount} match` : `${matchCount} of ${totalCount} match`}
          </span>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onSaveAsSegment}>
            Save as a segment
          </button>
        </span>
      )}
    </div>
  );
}
