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
import { useEffect, useId, useRef, useState } from 'react';
import { activeRules } from './segments';
import type { SegmentRule } from './types';
import { SEGMENT_STANDARD_FIELDS } from '../../../../src/domain/contacts';
import { MAX_SEGMENT_RULES } from '../../lib/domain-caps';
import { DEC_868, DEC_919, DEC_930, DEC_937 } from '../../../../src/decisions';

// NOTE (integration): the delegating task minted a fresh three-digit id for
// this disclosure behaviour. The id space has been CLOSED since wave 37
// (decisions/README.md) and the ids it reached for were already spent on
// unrelated rulings, so this file cites src/decisions-data/DEC-919.md -- the
// established capability-preservation/disclosure carve-out already used by
// this same page's other phone rules, e.g. DirectoryRail's stand-down
// comment above -- and keeps its existing DEC_868/DEC_937 compile pins. See
// app/src/pages/contacts/contacts-wave16-citation.scan.test.ts, which
// enforces this directory-wide.
void DEC_868;
void DEC_919;
void DEC_930;
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

// src/decisions-data/DEC-919.md: the 390 head's rule strip projects each ACTIVE rule as a
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
  // src/decisions-data/DEC-919.md: the 390 chip strip stands in for the
  // desktop rule groups, but
  // hiding those groups outright would remove the ability to author/edit a
  // rule on a phone. `builderOpen` is a PHONE-ONLY effect -- read by CSS at
  // width, never by a useIsPhone branch here -- so desktop markup (which
  // has no CSS rule keyed to `.is-builder-open`) stays byte-identical.
  const [builderOpen, setBuilderOpen] = useState(false);
  // src/decisions-data/DEC-930.md (amendment): the chip strip's caption IS
  // the group's accessible name via aria-labelledby -- never a duplicated
  // aria-label string, which would fork the name from the visible ink.
  const chipstripCaptionId = useId();

  // src/decisions-data/DEC-990.md (amendment, extending its wave-128
  // amendment carried by src/decisions-data/DEC-919.md: "a nav hidden at
  // phone needs a disclosure, not an exit"): a disclosure that reveals a
  // control moves focus INTO the specific control the trigger named, or
  // the disclosure has hidden the thing it just revealed. `focusRuleIndex`
  // is the pending target -- the rule position whose FIELD select should
  // receive focus once `.chq-contacts-filter-rules-row` is open -- and is
  // cleared the same effect tick it is consumed, so a later unrelated
  // re-render (e.g. typing into a value input) never re-steals focus. This
  // is a PHONE-ONLY effect exactly like `builderOpen` itself: at desktop
  // the rules row is never collapsed and both trigger controls
  // (`.chq-contacts-filter-add-chip`, `.chq-contacts-filter-rule-chip-edit`)
  // are `display: none`, so neither onClick below can ever fire there --
  // desktop markup and behaviour stay byte-identical. Ref shape follows
  // app/src/pages/comms/ComposeWizard.tsx's per-target ref idiom; the
  // focus-on-reveal call itself follows
  // app/src/pages/content/FilesLibrary.tsx:446
  // (`if (!phoneSearchOpen) searchInputRef.current?.focus();`).
  const [focusRuleIndex, setFocusRuleIndex] = useState<number | null>(null);
  const rulesRowRef = useRef<HTMLDivElement | null>(null);
  // src/decisions-data/DEC-990.md (amendment, wave-16 r4): the disclosure's
  // full contract, symmetric with the focus-in half above. `builderId`
  // names `.chq-contacts-filter-rules-row` so both triggers below can
  // `aria-controls` it and announce their own `aria-expanded` state --
  // otherwise nothing tells an AT user that "+ Rule"/a chip's edit button
  // opened anything. `addChipRef` is the trigger the disclosure returns
  // focus to on close: `Done` is the ONLY control that removes
  // `is-builder-open` (dropping the row -- and the just-clicked Done
  // button inside it -- to `display:none`), so `Done`'s handler is where
  // focus must be moved back OUT, mirroring the effect above that moves it
  // IN. Desktop is untouched: `.chq-contacts-filter-add-chip` is
  // `display:none` above 700px (contacts.css), so this ref is never the
  // active element there and `builderOpen`/`is-builder-open` has no
  // desktop CSS keyed to it (contacts.css:~136 for the `Done` button
  // itself).
  const builderId = useId();
  const addChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!builderOpen || focusRuleIndex === null) return;
    const row = rulesRowRef.current;
    if (!row) return;
    const target =
      row.querySelector<HTMLElement>(`[aria-label="Filter ${focusRuleIndex + 1} field"]`) ??
      row.querySelector<HTMLElement>('.chq-contacts-filter-builder-done');
    target?.focus();
    setFocusRuleIndex(null);
  }, [builderOpen, focusRuleIndex]);

  function updateRule(index: number, next: SegmentRule) {
    onChange(rules.map((r, i) => (i === index ? next : r)));
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function addRule() {
    onChange([...rules, { field: FILTER_RULE_FIELDS[0]!, op: 'contains', value: '' }]);
  }

  // src/decisions-data/DEC-990.md (amendment, wave-16 r4): `Done` is the
  // ONLY place a blank rule is pruned. `addRule()` (above) is shared with
  // the desktop `.chq-contacts-filter-add-full` "Add a rule" button, which
  // has no `Done` control (`display:none` at desktop) -- pruning inside
  // `addRule()` itself would change desktop behaviour, which the frozen
  // desktop invariant forbids. A blank rule renders no chip
  // (`activeRules()`, segments.ts:92) yet still counts against
  // MAX_SEGMENT_RULES, so leaving it un-reconciled lets a phone user hit
  // the cap on rules they can never see. This also closes the disclosure
  // and returns focus to its trigger (`addChipRef`) -- the row this
  // button lives in goes `display:none` the instant `builderOpen` flips,
  // so without this the browser drops focus to `<body>`.
  function closeBuilder() {
    if (rules.some((r) => r.value.trim() === '')) {
      onChange(rules.filter((r) => r.value.trim() !== ''));
    }
    setBuilderOpen(false);
    addChipRef.current?.focus();
  }

  return (
    <>
    <div
      id={builderId}
      className={`chq-contacts-filter-rules-row${builderOpen ? ' is-builder-open' : ''}`}
      ref={rulesRowRef}
    >
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
          capability renders twice in the DOM, once on screen, src/decisions-data/DEC-919.md's
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

      {/* src/decisions-data/DEC-919.md (see note above imports): the
          builder-close control only
          means anything for the collapsed-by-default 390 state -- it
          renders unconditionally (both controls in the DOM, CSS decides
          which is on screen, the DEC-937 wave-129 shape) and is
          display:none at desktop. */}
      <button
        type="button"
        className="chq-btn chq-btn-tertiary chq-contacts-filter-builder-done"
        onClick={closeBuilder}
      >
        Done
      </button>
    </div>

    {/* src/decisions-data/DEC-930.md (amendment): this narrowing strip is a
        named group -- its visible caption ("All of") IS the group's
        accessible name via aria-labelledby, never a duplicated aria-label
        string that would fork the name from the ink. */}
    <div
      className="chq-contacts-filter-chipstrip"
      role="group"
      aria-labelledby={activeRules(rules).length > 0 ? chipstripCaptionId : undefined}
    >
      {/* src/decisions-data/DEC-919.md (wave-16 amendment): the caption slot
          carries the truth about the strip -- it stands down when
          `activeRules(rules)` is empty rather than asserting "All of" over
          nothing, per docs/design/Chautauqua Contacts.dc.html:188-189
          (`All of` heads a non-empty `sc-for` run over `{{ activeRules }}`,
          never an empty one). When it stands down the group's
          aria-labelledby stands down with it, so the name never points at
          an absent node (DEC-930's "name from the ink" rule). */}
      {activeRules(rules).length > 0 && (
        <span className="chq-contacts-filter-chipstrip-caption" id={chipstripCaptionId}>All of</span>
      )}
      {rules.map((rule, i) =>
        activeRules([rule]).length === 0 ? null : (
          <span className="chq-contacts-filter-rule-chip" key={i}>
            <button
              type="button"
              className="chq-contacts-filter-rule-chip-edit"
              aria-label={`Edit ${ruleChipLabel(rule)}`}
              aria-expanded={builderOpen}
              aria-controls={builderId}
              onClick={() => {
                setFocusRuleIndex(i);
                setBuilderOpen(true);
              }}
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
      {/* src/decisions-data/DEC-919.md (wave-16 amendment): at the cap with
          the builder CLOSED, `.chq-contacts-filter-add-chip` stays enabled
          by design (its job here is disclosure, not adding) but the ONLY
          cap explanation -- `.chq-contacts-filter-rules-cap` -- lives
          inside `.chq-contacts-filter-rules-row`, which is display:none at
          390 while the builder is closed. This second cap caption is the
          chip strip's own member of that same capability, gated on the
          same `rules.length >= MAX_SEGMENT_RULES` bound so the strip never
          reads a control with no reason on screen. Capability
          substitution, not removal -- the desktop cap copy is untouched. */}
      {rules.length >= MAX_SEGMENT_RULES && (
        <span className="chq-contacts-filter-chipstrip-cap">
          Up to {MAX_SEGMENT_RULES} rules.
        </span>
      )}
      <button
        type="button"
        className="chq-contacts-filter-add-chip"
        ref={addChipRef}
        aria-expanded={builderOpen}
        aria-controls={builderId}
        onClick={() => {
          // DEC-990 amendment (extending src/decisions-data/DEC-919.md's
          // wave-128 amendment): the newly-appended rule's index is
          // `rules.length` taken BEFORE the append. At the cap nothing is
          // appended, so focus falls back to the LAST existing rule's
          // field select instead (`rules.length - 1`); with zero rules at
          // the cap (impossible today, MAX_SEGMENT_RULES > 0, but kept
          // total) the effect's own querySelector fallback lands on
          // `.chq-contacts-filter-builder-done` since no `Filter 0 field`
          // select exists.
          if (rules.length < MAX_SEGMENT_RULES) {
            setFocusRuleIndex(rules.length);
            addRule();
          } else {
            setFocusRuleIndex(rules.length - 1);
          }
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
