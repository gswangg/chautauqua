// Portal editor · "Match participations where" (Portals frame, flow 2): an
// OR of AND groups. Each condition is a field, a test and its values; "is"
// and "is not" take one value, "is any of" and "is none of" take several
// (a checkbox menu), "is empty" and "is not empty" take none.
import { Fragment, useCallback, useState } from 'react';
import { RULE_OPS } from '../../../../src/domain/portals/rules';
import { useMenu } from '../../lib/useMenu';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';
import { MAX_RULE_CONDITIONS, MAX_RULE_GROUPS } from '../../lib/domain-caps';
import { RULE_OP_LABELS, conditionAnchor, isMultiOp, isValueless, withOp, type RuleCondition, type RuleOp } from './portalDraft';
import type { PortalRule, RuleFieldOption } from './types';

interface RuleEditorProps {
  rule: PortalRule;
  options: RuleFieldOption[];
  onChange: (rule: PortalRule) => void;
  // anchors of conditions flagged by Review and save (no value yet)
  invalid: ReadonlySet<string>;
}

const DEFAULT_FIELD = 'role';

function newCondition(options: RuleFieldOption[]): RuleCondition {
  const field = options.some((o) => o.field === DEFAULT_FIELD) ? DEFAULT_FIELD : (options[0]?.field ?? DEFAULT_FIELD);
  return { field, op: 'is', values: [] };
}

// A saved rule can name a field this event offers no list for (a contact
// custom field): it still shows, labelled, with free-text values.
function fieldOptions(options: RuleFieldOption[], rule: PortalRule): RuleFieldOption[] {
  const known = new Set(options.map((o) => o.field));
  const extra: RuleFieldOption[] = [];
  for (const g of rule.groups) {
    for (const c of g.conditions) {
      if (known.has(c.field)) continue;
      known.add(c.field);
      extra.push({ field: c.field, label: c.field.startsWith('custom:') ? `Contact field ${c.field.slice(7)}` : c.field, values: [] });
    }
  }
  return [...options, ...extra];
}

function ValuesMenu({
  id,
  values,
  choices,
  onChange,
  invalid,
}: {
  id: string;
  values: string[];
  choices: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // outside press and Escape close the list and hand focus back to the
  // trigger (the list holds checkboxes, not menu items)
  const { containerRef } = useMenu(open, close);
  const chosen = choices.filter((c) => values.includes(c.value)).map((c) => c.label);
  // a saved value this event no longer lists still shows
  const orphans = values.filter((v) => !choices.some((c) => c.value === v));
  const label = [...chosen, ...orphans].join(', ');
  return (
    <div className="chq-portal-values" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="chq-select chq-portal-values-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-invalid={invalid ? 'true' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {label === '' ? 'Choose values' : label}
      </button>
      {open ? (
        <div className="chq-portal-values-list" role="group" aria-label="Values">
          {choices.map((c) => {
            const on = values.includes(c.value);
            return (
              <label key={c.value} className="chq-checkbox-label chq-portal-values-option">
                <input
                  type="checkbox"
                  className="chq-check"
                  checked={on}
                  onChange={() => onChange(on ? values.filter((v) => v !== c.value) : [...values, c.value])}
                />
                {c.label}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ValueControl({
  id,
  condition,
  option,
  onChange,
  invalid,
}: {
  id: string;
  condition: RuleCondition;
  option: RuleFieldOption | undefined;
  onChange: (values: string[]) => void;
  invalid: boolean;
}) {
  if (isValueless(condition.op)) return null;
  const choices = option?.values ?? [];
  if (choices.length === 0) {
    // no list for this field: typed values, comma-separated
    return (
      <input
        id={id}
        className="chq-input chq-portal-rule-text"
        aria-label="Values"
        aria-invalid={invalid ? 'true' : undefined}
        placeholder={isMultiOp(condition.op) ? 'Values, separated by commas' : 'Value'}
        value={condition.values.join(', ')}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) =>
          onChange(
            isMultiOp(condition.op)
              ? e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
              : e.target.value.trim() === ''
                ? []
                : [e.target.value],
          )
        }
      />
    );
  }
  if (isMultiOp(condition.op)) {
    return <ValuesMenu id={id} values={condition.values} choices={choices} onChange={onChange} invalid={invalid} />;
  }
  const current = condition.values[0] ?? '';
  const orphan = current !== '' && !choices.some((c) => c.value === current);
  return (
    <select
      id={id}
      className="chq-select chq-portal-rule-select"
      aria-label="Value"
      aria-invalid={invalid ? 'true' : undefined}
      value={current}
      onChange={(e) => onChange(e.target.value === '' ? [] : [e.target.value])}
    >
      <option value="">Choose a value</option>
      {orphan ? <option value={current}>{current}</option> : null}
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

export function RuleEditor({ rule, options, onChange, invalid }: RuleEditorProps) {
  const fields = fieldOptions(options, rule);
  const groups = rule.groups;

  function setGroups(next: PortalRule['groups']) {
    onChange({ groups: next });
  }

  function setCondition(gi: number, ci: number, c: RuleCondition) {
    setGroups(groups.map((g, i) => (i === gi ? { conditions: g.conditions.map((x, j) => (j === ci ? c : x)) } : g)));
  }

  function removeCondition(gi: number, ci: number) {
    const next = groups
      .map((g, i) => (i === gi ? { conditions: g.conditions.filter((_, j) => j !== ci) } : g))
      .filter((g) => g.conditions.length > 0);
    setGroups(next);
  }

  function addCondition(gi: number) {
    setGroups(groups.map((g, i) => (i === gi ? { conditions: [...g.conditions, newCondition(options)] } : g)));
  }

  function addGroup() {
    setGroups([...groups, { conditions: [newCondition(options)] }]);
  }

  if (groups.length === 0) {
    return (
      <div className="chq-portal-rule">
        <p className="chq-portal-rule-empty">No conditions yet, so this portal matches nobody. Saving it like this is fine while you set it up.</p>
        <div className="chq-portal-rule-adds">
          <button type="button" className="chq-link-button chq-portal-rule-add" onClick={addGroup}>
            Add a condition
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chq-portal-rule">
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {gi > 0 ? (
            <div className="chq-portal-rule-or" aria-hidden="true">
              <span className="chq-portal-rule-word">Or</span>
              <span className="chq-portal-rule-or-line" />
            </div>
          ) : null}
          <div className="chq-portal-rule-group" role="group" aria-label={groups.length > 1 ? `Group ${gi + 1}, all of` : 'All of'}>
            <span className="chq-portal-rule-word">All of</span>
            {g.conditions.map((c, ci) => {
              const option = fields.find((f) => f.field === c.field);
              const anchor = conditionAnchor(gi, ci);
              const bad = invalid.has(anchor);
              return (
                <div key={ci} className="chq-portal-rule-row" data-invalid={bad ? 'true' : undefined}>
                  <select
                    className="chq-select chq-portal-rule-select"
                    aria-label="Field"
                    value={c.field}
                    onChange={(e) => setCondition(gi, ci, { field: e.target.value, op: c.op, values: [] })}
                  >
                    {fields.map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="chq-select chq-portal-rule-select"
                    aria-label="Test"
                    value={c.op}
                    onChange={(e) => setCondition(gi, ci, withOp(c, e.target.value as RuleOp))}
                  >
                    {RULE_OPS.map((op) => (
                      <option key={op} value={op}>
                        {RULE_OP_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  <ValueControl
                    id={anchor}
                    condition={c}
                    option={option}
                    invalid={bad}
                    onChange={(values) => setCondition(gi, ci, { ...c, values })}
                  />
                  <button type="button" className="chq-link-button chq-portal-rule-remove" onClick={() => removeCondition(gi, ci)}>
                    Remove
                  </button>
                  {bad ? (
                    <span className="chq-portal-rule-error" role="alert">
                      <span aria-hidden="true">&#9650; </span>
                      Choose a value, or remove this condition.
                    </span>
                  ) : null}
                </div>
              );
            })}
            <div className="chq-portal-rule-adds">
              <button
                type="button"
                className="chq-link-button chq-portal-rule-add"
                onClick={() => addCondition(gi)}
                disabled={g.conditions.length >= MAX_RULE_CONDITIONS}
              >
                Add a condition
              </button>
              {gi === groups.length - 1 ? (
                <button type="button" className="chq-link-button chq-portal-rule-add" onClick={addGroup} disabled={groups.length >= MAX_RULE_GROUPS}>
                  Add an “or” group
                </button>
              ) : null}
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
