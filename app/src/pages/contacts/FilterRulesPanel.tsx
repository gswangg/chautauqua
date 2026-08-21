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
import { useState } from 'react';
import { activeRules } from './segments';
import type { SegmentRule } from './types';
import { SEGMENT_STANDARD_FIELDS } from '../../../../src/domain/contacts';
import { MAX_SEGMENT_RULES } from '../../lib/domain-caps';
import { DEC_868, DEC_919, DEC_937 } from '../../../../src/decisions';

// NOTE (worker r1-b): the delegating task cited DEC-993/DEC-992 for this
// disclosure behaviour, but src/decisions-data (binding per project
// instructions) has DEC-993 = "One 'Insert a field' control per composer…"
// (mail merge-field menu) and DEC-992 = "The merge compare table names BOTH
// records…" (contact-merge duplicate screen) -- neither is about the
// Contacts filter builder. Rather than compile-check a false dependency
// (the exact "registry laundering" failure mode this campaign's field
// guide repeatedly flags), this file cites DEC_919 (the established
// capability-preservation/disclosure carve-out already used by this same
// page's other phone rules, e.g. DirectoryRail's stand-down comment above)
// and keeps its existing DEC_868/DEC_937 citations. Flagged for the
// planner/scribe to reconcile the DEC-992/DEC-993 numbering.
void DEC_868;
void DEC_919;
void DEC_937;

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

// DEC-992: the 390 head's rule strip projects each ACTIVE rule as a
// dismissible chip, in the SAME vocabulary the desktop builder uses for its
// own field/op selects (FIELD_LABELS / OP_OPTIONS above) -- not
// segments.ts's describeRules, which renders `=`/`≠` and quotes for the
// segments LIST, a different surface with a different grammar.
export function ruleChipLabel(rule: SegmentRule): string {
  const field = rule.field.startsWith('custom.')
    ? rule.field.slice('custom.'.length)
    : (FIELD_LABELS[rule.field] ?? rule.field);
  const op = OP_OPTIONS.find((o) => o.value === rule.op)?.label ?? rule.op;
  return `${field} ${op} ${rule.value}`;
}

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
  // DEC-919: the 390 chip strip stands in for the desktop rule groups, but
  // hiding those groups outright would remove the ability to author/edit a
  // rule on a phone. `builderOpen` is a PHONE-ONLY effect -- read by CSS at
  // width, never by a useIsPhone branch here -- so desktop markup (which
  // has no CSS rule keyed to `.is-builder-open`) stays byte-identical.
  const [builderOpen, setBuilderOpen] = useState(false);

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
    <>
    <div className={`chq-contacts-filter-rules-row${builderOpen ? ' is-builder-open' : ''}`}>
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

      {/* DEC-937 wave-129: docs/design/Chautauqua Contacts.dc.html:188-192
          draws the 390 head's rule strip terminating in its OWN dashed
          "+ Rule" chip, not the desktop panel's plain-text "Add a rule" --
          a shared idiom (this tertiary button) is still scoped by the
          frame that draws it. Both controls render unconditionally (the
          capability renders twice in the DOM, once on screen, DEC-919's
          established shape); contacts.css's terminal max-width:700px
          block is the ONLY place that decides which one is visible, so
          exactly one copy is ever on screen at a given width. Same
          addRule handler, same MAX_SEGMENT_RULES-disabled state -- only
          the control's identity and copy swap per width. */}
      <button
        type="button"
        className="chq-btn chq-btn-tertiary chq-contacts-filter-add-full"
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

      {/* DEC-919 (see note above imports): the builder-close control only
          means anything for the collapsed-by-default 390 state -- it
          renders unconditionally (both controls in the DOM, CSS decides
          which is on screen, the DEC-937 wave-129 shape) and is
          display:none at desktop. */}
      <button
        type="button"
        className="chq-btn chq-btn-tertiary chq-contacts-filter-builder-done"
        onClick={() => setBuilderOpen(false)}
      >
        Done
      </button>
    </div>

    <div className="chq-contacts-filter-chipstrip">
      <span className="chq-contacts-filter-chipstrip-caption">All of</span>
      {rules.map((rule, i) =>
        activeRules([rule]).length === 0 ? null : (
          <span className="chq-contacts-filter-rule-chip" key={i}>
            <button
              type="button"
              className="chq-contacts-filter-rule-chip-edit"
              aria-label={`Edit ${ruleChipLabel(rule)}`}
              onClick={() => setBuilderOpen(true)}
            >
              {ruleChipLabel(rule)}
            </button>
            <button
              type="button"
              className="chq-contacts-filter-rule-chip-dismiss"
              aria-label={`Remove ${ruleChipLabel(rule)}`}
              onClick={() => removeRule(i)}
            >
              ✕
            </button>
          </span>
        )
      )}
      {/* DEC-919: while the builder is CLOSED this control's job is
          disclosure, so it is never inert here -- otherwise a user who
          fills the cap with blank rules (which render no chip) and closes
          the builder has no path back in. Only inert once the builder is
          open AND the cap is reached, matching the desktop
          `.chq-contacts-filter-add-full` button's own disabled state. */}
      <button
        type="button"
        className="chq-contacts-filter-add-chip"
        onClick={() => {
          if (rules.length < MAX_SEGMENT_RULES) addRule();
          setBuilderOpen(true);
        }}
        disabled={builderOpen && rules.length >= MAX_SEGMENT_RULES}
      >
        + Rule
      </button>
    </div>
    </>
  );
}
