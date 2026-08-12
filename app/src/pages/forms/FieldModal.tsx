import { useState, type FormEvent, type MouseEvent } from 'react';
import { deserializeRule, ruleReferenceCandidates, serializeRule, type RuleBuilderState } from './logic';
import { FIELD_KINDS, RULE_OPS, kindLabel, type FormField, type FormFieldKind, type FormFieldSection } from './types';
import { useEscapeKey } from '../../lib/useEscapeKey';

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
  onCancel: () => void;
  onSubmit: (input: FieldModalInput) => Promise<void>;
}

/** Add/edit modal for a custom form field: section, kind, label, help text,
 * required toggle, options editor (dropdown), and conditional-visibility
 * rule builder (form_field.rule_json: { fieldId, op, value }). */
export function FieldModal({ field, allFields, onCancel, onSubmit }: FieldModalProps) {
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
      setError('Dropdown fields need at least one option.');
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
        required,
        options: kind === 'dropdown' ? options : undefined,
        rule: serializeRule(rule),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save field');
    } finally {
      setSubmitting(false);
    }
  }

  useEscapeKey(true, onCancel);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !submitting) onCancel();
  }

  return (
    <div
      className="chq-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={field ? 'Edit field' : 'New field'}
      onClick={handleScrimClick}
    >
      <form className="chq-modal chq-forms-field-modal" onSubmit={handleSubmit}>
        <h2>{field ? 'Edit field' : 'New field'}</h2>

        {error && <div className="chq-error-banner">{error}</div>}

        <label className="chq-field">
          Section
          <select className="chq-select" value={section} onChange={(e) => setSection(e.target.value as FormFieldSection)}>
            <option value="session">Session</option>
            <option value="speaker">Speaker</option>
          </select>
        </label>

        <label className="chq-field">
          Kind
          <select className="chq-select" value={kind} onChange={(e) => setKind(e.target.value as FormFieldKind)}>
            {FIELD_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>

        <label className="chq-field">
          Label
          <input className="chq-input" type="text" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>

        <label className="chq-field">
          Help text
          <textarea className="chq-textarea" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
        </label>

        <label className="chq-checkbox-label">
          <input className="chq-check" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>

        {kind === 'dropdown' && (
          <label className="chq-field">
            Options (one per line)
            <textarea className="chq-textarea" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
          </label>
        )}

        <fieldset className="chq-forms-rule-builder">
          <legend>Show this field when...</legend>
          <label className="chq-field">
            Field
            <select className="chq-select" value={rule.fieldId} onChange={(e) => setRule({ ...rule, fieldId: e.target.value })}>
              <option value="">Always visible</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {rule.fieldId.length > 0 && (
            <>
              <label className="chq-field">
                Condition
                <select
                  className="chq-select"
                  value={rule.op}
                  onChange={(e) => setRule({ ...rule, op: e.target.value as RuleBuilderState['op'] })}
                >
                  {RULE_OPS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </label>
              <label className="chq-field">
                Value{rule.op === 'in' ? ' (comma-separated)' : ''}
                <input className="chq-input" type="text" value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })} />
              </label>
            </>
          )}
        </fieldset>

        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
