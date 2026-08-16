import { useState, type FormEvent } from 'react';
import { ruleOpLabel } from './condition';
import {
  defaultRuleValue,
  deserializeRule,
  hasRule,
  requiredForSave,
  ruleReferenceCandidates,
  ruleValueControl,
  serializeRule,
  type RuleBuilderState,
} from './logic';
import {
  FIELD_KIND_LABELS,
  FIELD_KINDS,
  RULE_OPS,
  kindLabel,
  type FormField,
  type FormFieldKind,
  type FormFieldSection,
} from './types';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../../lib/text-caps';
import { MAX_FIELD_OPTIONS } from '../../lib/batch-caps';

export interface FieldModalInput {
  section: FormFieldSection;
  kind: FormFieldKind;
  label: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  rule?: FormField['rule'];
}

interface FieldModalProps {
  /** The field being edited, or undefined when creating a new one. */
  field?: FormField;
  /** All fields currently on the form (used to populate the rule builder). */
  allFields: FormField[];
  /** DEC-650(d): the blast radius the header states -- the count
   * FormsPage already holds (submissions total), never fabricated or
   * derived here. `null` while loading/errored renders no line at all. */
  answeredCount?: number | null;
  onCancel: () => void;
  onSubmit: (input: FieldModalInput) => Promise<void>;
  // DEC-650 (wave-66 amendment): only present when editing an existing
  // field -- a new, unsaved field has nothing to delete. FormsPage wires
  // this to the SAME handler FieldList's row Delete already uses (reuse,
  // not a second delete path); that handler opens the shared ConfirmDialog
  // at irreversible weight.
  onDelete?: () => void;
}

/** Add/edit modal for a custom form field: section, kind, label, help text,
 * required toggle, options editor (dropdown), and conditional-visibility
 * rule builder (form_field.rule_json: { fieldId, op, value }). */
export function FieldModal({ field, allFields, answeredCount, onCancel, onSubmit, onDelete }: FieldModalProps) {
  const [section, setSection] = useState<FormFieldSection>(field?.section ?? 'session');
  const [kind, setKind] = useState<FormFieldKind>(field?.kind ?? 'text');
  const [label, setLabel] = useState(field?.label ?? '');
  const [helpText, setHelpText] = useState(field?.helpText ?? '');
  const [required, setRequired] = useState(field?.required ?? false);
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join('\n'));
  const [rule, setRule] = useState<RuleBuilderState>(deserializeRule(field?.rule));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = ruleReferenceCandidates(allFields, field);
  const trigger = candidates.find((c) => c.id === rule.fieldId);
  const valueControl = ruleValueControl(trigger);

  /** Trigger and op both determine what values are matchable (DEC-681), so
   * changing either resets the value to the new control's default rather
   * than carrying over a value the new control can't represent. */
  function setTrigger(fieldId: string) {
    const nextTrigger = candidates.find((c) => c.id === fieldId);
    setRule({ fieldId, op: rule.op, value: defaultRuleValue(ruleValueControl(nextTrigger)) });
  }

  function setOp(op: RuleBuilderState['op']) {
    setRule({ fieldId: rule.fieldId, op, value: defaultRuleValue(valueControl) });
  }

  function toggleOptionValue(option: string, checked: boolean) {
    const selected = new Set(
      rule.value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    );
    if (checked) selected.add(option);
    else selected.delete(option);
    const ordered = (trigger?.options ?? []).filter((o) => selected.has(o));
    setRule({ ...rule, value: ordered.join(', ') });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (label.trim().length === 0) {
      setError('Label is required.');
      return;
    }
    const options = optionsText
      .split('\n')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (kind === 'dropdown' && options.length === 0) {
      setError(`${FIELD_KIND_LABELS.dropdown} fields need at least one option.`);
      return;
    }
    if (kind === 'dropdown' && options.length > MAX_FIELD_OPTIONS) {
      setError(`Max ${MAX_FIELD_OPTIONS} options`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        section,
        kind,
        label: label.trim(),
        helpText: helpText.trim().length > 0 ? helpText.trim() : undefined,
        // DEC-650(c): a hidden question is never required -- enforced here,
        // not merely captioned, so a rule added after the box was ticked
        // can never ship a required-but-invisible question.
        required: requiredForSave(required, rule),
        options: kind === 'dropdown' ? options : undefined,
        rule: serializeRule(rule),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save field');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      // DEC-650 (wave-3 amendment): frame 02--10 in
      // docs/design/Chautauqua Submissions.dc.html draws the edit dialog
      // titled "Edit a question" (the substantial half is conditional
      // visibility, not a bare field-editor chrome). The create case isn't
      // separately drawn; it takes the SAME grammar the drawn "Add a
      // question" trigger button already uses one panel over, rather than
      // inventing a third phrase.
      title={field ? 'Edit a question' : 'Add a question'}
      subtitle={
        typeof answeredCount === 'number'
          ? `${answeredCount} people have already answered this form — editing a live question changes what those answers mean`
          : undefined
      }
      onClose={onCancel}
      closeDisabled={submitting}
      modalClassName="chq-forms-field-modal"
      actions={
        <>
          {/* DEC-650 (wave-66 amendment, DESIGN-RULINGS.md:314): Delete sits
              far left, Cancel/Save right-flushed in their own group --
              never adjacent to Delete. Only rendered when editing an
              existing field. */}
          {field && onDelete && (
            <button
              type="button"
              className="chq-btn chq-btn-destructive-tertiary chq-forms-field-delete"
              onClick={onDelete}
              disabled={submitting}
            >
              Delete
            </button>
          )}
          <div className="chq-forms-field-modal-actions-right">
            <button type="submit" className="chq-btn chq-btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </>
      }
    >
      {error && <div className="chq-error-banner">{error}</div>}

        <FormRow label="Section" htmlFor="field-section">
          <select
            id="field-section"
            className="chq-select"
            value={section}
            onChange={(e) => setSection(e.target.value as FormFieldSection)}
          >
            <option value="session">Session</option>
            <option value="speaker">Speaker</option>
          </select>
          <p className="chq-meta">
            {section === 'speaker'
              ? 'Hidden from reviewers while a plan is anonymised.'
              : 'Shown to reviewers, including on an anonymised plan.'}
          </p>
        </FormRow>

        <FormRow label="Kind" htmlFor="field-kind">
          <select id="field-kind" className="chq-select" value={kind} onChange={(e) => setKind(e.target.value as FormFieldKind)}>
            {FIELD_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Label" htmlFor="field-label">
          <input
            id="field-label"
            className="chq-input"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Talk abstract"
            required
          />
        </FormRow>

        <FormRow label="Help text" htmlFor="field-help-text" optional>
          <textarea
            id="field-help-text"
            className="chq-textarea"
            maxLength={MAX_TEXT_LENGTH}
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            placeholder="Shown beneath the field, e.g. 300 words max"
          />
        </FormRow>

        <label className="chq-checkbox-label">
          <input
            className="chq-check"
            type="checkbox"
            checked={required && !hasRule(rule)}
            disabled={hasRule(rule)}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Required
        </label>
        {hasRule(rule) && (
          <p className="chq-meta">
            A hidden question is never required — if the submitter cannot see it, it cannot block their submission.
          </p>
        )}

        {kind === 'dropdown' && (
          <FormRow label="Options (one per line)" htmlFor="field-options" optional>
            <textarea
              id="field-options"
              className="chq-textarea"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={'Beginner\nIntermediate\nAdvanced'}
            />
            <p className="chq-meta">
              {optionsText.split('\n').filter((o) => o.trim().length > 0).length} of {MAX_FIELD_OPTIONS} options
            </p>
          </FormRow>
        )}

        {/* DEC-650(a): the rule reads as a SENTENCE -- leading copy, then the
            trigger/condition/value controls inline -- and the off case is
            STATED, never implied by an empty select. */}
        <fieldset className="chq-forms-rule-builder">
          <legend>Conditional visibility</legend>
          <p className="chq-forms-rule-sentence">Only show this question when…</p>
          <FormRow label="Field" htmlFor="field-rule-trigger">
            <select
              id="field-rule-trigger"
              className="chq-select"
              value={rule.fieldId}
              onChange={(e) => setTrigger(e.target.value)}
            >
              <option value="">Always visible</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormRow>
          {rule.fieldId.length === 0 && (
            <p className="chq-meta">Leave it off and the question always shows.</p>
          )}
          {rule.fieldId.length > 0 && (
            <>
              <FormRow label="Condition" htmlFor="field-rule-op">
                <select
                  id="field-rule-op"
                  className="chq-select"
                  value={rule.op}
                  onChange={(e) => setOp(e.target.value as RuleBuilderState['op'])}
                >
                  {RULE_OPS.map((op) => (
                    <option key={op} value={op}>
                      {ruleOpLabel(op)}
                    </option>
                  ))}
                </select>
              </FormRow>

              {valueControl === 'boolean' && (
                <FormRow label="Value" htmlFor="field-rule-value">
                  <select
                    id="field-rule-value"
                    className="chq-select"
                    value={rule.value}
                    onChange={(e) => setRule({ ...rule, value: e.target.value })}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormRow>
              )}

              {valueControl === 'number' && (
                <FormRow label="Value" htmlFor="field-rule-value">
                  <input
                    id="field-rule-value"
                    className="chq-input"
                    type="number"
                    value={rule.value}
                    onChange={(e) => setRule({ ...rule, value: e.target.value })}
                  />
                </FormRow>
              )}

              {valueControl === 'options' && rule.op !== 'in' && (
                <FormRow label="Value" htmlFor="field-rule-value">
                  <select
                    id="field-rule-value"
                    className="chq-select"
                    value={rule.value}
                    onChange={(e) => setRule({ ...rule, value: e.target.value })}
                  >
                    <option value="">Select an option</option>
                    {(trigger?.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FormRow>
              )}

              {valueControl === 'options' && rule.op === 'in' && (
                <fieldset className="chq-forms-rule-options">
                  <legend>Value (any of)</legend>
                  {(trigger?.options ?? []).map((o) => {
                    const selected = rule.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter((v) => v.length > 0);
                    return (
                      <label key={o} className="chq-checkbox-label">
                        <input
                          className="chq-check"
                          type="checkbox"
                          checked={selected.includes(o)}
                          onChange={(e) => toggleOptionValue(o, e.target.checked)}
                        />
                        {o}
                      </label>
                    );
                  })}
                </fieldset>
              )}

              {valueControl === 'text' && (
                <FormRow label={`Value${rule.op === 'in' ? ' (comma-separated)' : ''}`} htmlFor="field-rule-value">
                  <input
                    id="field-rule-value"
                    className="chq-input"
                    type="text"
                    value={rule.value}
                    onChange={(e) => setRule({ ...rule, value: e.target.value })}
                    placeholder="Keynote"
                  />
                </FormRow>
              )}
            </>
          )}
        </fieldset>
    </ModalFrame>
  );
}
