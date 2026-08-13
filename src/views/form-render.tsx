// Shared form renderer (owned by w2-d): renders FormFieldDef[] + AnswerMap
// to hono/jsx inputs, plus a JSON script + ~30 lines of inline vanilla JS
// implementing DEC-008 show/hide toggling for fields with a `rule`. The
// server always revalidates regardless (src/forms/validate.ts) — this is
// progressive enhancement only, never the source of truth.

import type { FormFieldDef, AnswerMap } from "../forms/types";
import { ALLOWED_UPLOAD_EXTENSIONS, uploadHintText } from "../domain/files";
import { RULE_MATCH_JS } from "../forms/rule-match";
import { MAX_LONG_TEXT_LENGTH } from "../forms/validate";
import { OPTIONAL_SUFFIX } from "../domain/form-copy";

export const FIELD_NAME_PREFIX = "field__";

export function fieldInputName(fieldId: string): string {
  return `${FIELD_NAME_PREFIX}${fieldId}`;
}

function wrapId(fieldId: string): string {
  return `chq-field-wrap-${fieldId}`;
}

function FieldControl(props: { field: FormFieldDef; value: unknown }) {
  const { field, value } = props;
  const name = fieldInputName(field.id);
  switch (field.kind) {
    case "text":
      return (
        <input
          type="text"
          class="chq-input"
          id={name}
          name={name}
          data-field-id={field.id}
          value={typeof value === "string" ? value : ""}
          required={field.required}
          data-required={field.required ? "true" : "false"}
        />
      );
    case "long_text":
      return (
        <textarea
          class="chq-textarea"
          id={name}
          name={name}
          data-field-id={field.id}
          required={field.required}
          data-required={field.required ? "true" : "false"}
        >
          {typeof value === "string" ? value : ""}
        </textarea>
      );
    case "dropdown":
      return (
        <select
          class="chq-select"
          id={name}
          name={name}
          data-field-id={field.id}
          required={field.required}
          data-required={field.required ? "true" : "false"}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option value={opt} selected={value === opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <input
          type="checkbox"
          id={name}
          name={name}
          data-field-id={field.id}
          value="true"
          checked={Boolean(value)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          class="chq-input"
          id={name}
          name={name}
          data-field-id={field.id}
          value={typeof value === "number" ? String(value) : ""}
          required={field.required}
          data-required={field.required ? "true" : "false"}
        />
      );
    case "file":
      return (
        <input
          type="file"
          id={name}
          name={name}
          data-field-id={field.id}
          accept={ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",")}
        />
      );
    default: {
      const exhaustive: never = field.kind;
      throw new Error(`unknown field kind: ${exhaustive}`);
    }
  }
}

function formatThousands(n: number): string {
  return n.toLocaleString("en-US");
}

/** One labeled field, wrapped in the div the visibility script toggles. */
export function FormField(props: { field: FormFieldDef; value: unknown; error?: string; visible: boolean }) {
  const { field, value, error, visible } = props;
  // DEC-909: a long-text field with a budget carries a live counter, seeded
  // here with the initial (prefilled) length; the inline script keeps it in
  // sync with the DOM as the submitter types.
  const counterMax = field.kind === "long_text" ? field.maximum ?? MAX_LONG_TEXT_LENGTH : undefined;
  const initialCount = typeof value === "string" ? value.length : 0;
  return (
    <div id={wrapId(field.id)} class="chq-field" style={visible ? undefined : "display:none"}>
      <label>
        <span class="chq-field-label-row">
          <span class="chq-field-label">
            {field.label}
            {field.required === false ? <span class="chq-field-optional">{OPTIONAL_SUFFIX}</span> : null}
          </span>
          {counterMax !== undefined ? (
            <span class="chq-field-counter" data-field-counter={field.id} data-max={counterMax}>
              {formatThousands(initialCount)} / {formatThousands(counterMax)}
            </span>
          ) : null}
        </span>
        <FieldControl field={field} value={value} />
      </label>
      {field.helpText ? <p class="help">{field.helpText}</p> : null}
      {field.kind === "file" ? <p class="help">{uploadHintText()}</p> : null}
      {error ? (
        // DEC-367: errors are distinguished by type (weight/marker), never
        // by colour -- no semantic red anywhere in the palette.
        <p role="alert" class="chq-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Renders every field in a section, in position order, prefilled from
 * `answers` and with `errors` (post-validation, if any) inline. Visibility
 * at render time uses the same isVisible rule the server validates with. */
export function FormFieldsSection(props: {
  fields: FormFieldDef[];
  section: FormFieldDef["section"];
  answers: AnswerMap;
  errors?: Record<string, string>;
  isVisible: (field: FormFieldDef, answers: AnswerMap) => boolean;
}) {
  const { fields, section, answers, errors, isVisible } = props;
  const sectionFields = fields.filter((f) => f.section === section).sort((a, b) => a.position - b.position);
  return (
    <>
      {sectionFields.map((field) => (
        <FormField
          field={field}
          value={answers[field.id]}
          error={errors?.[field.id]}
          visible={isVisible(field, answers)}
        />
      ))}
    </>
  );
}

/** Emits the field-rules JSON + the inline vanilla-JS toggler. Server-side
 * validation (validateAnswers) is authoritative regardless of this script. */
export function FieldRulesScript(props: { fields: FormFieldDef[] }) {
  const kindById = new Map(props.fields.map((f) => [f.id, f.kind] as const));
  const rules = props.fields
    .filter((f) => f.rule)
    .map((f) => ({
      fieldId: f.id,
      rule: f.rule,
      triggerKind: f.rule ? kindById.get(f.rule.fieldId) : undefined,
    }));
  const json = JSON.stringify(rules);
  const safeJson = json.replace(/</g, "\\u003c");
  // DEC-681: browser twin agrees with the server via the shared
  // RULE_MATCH_JS canonicalizer, and computes the same TRANSITIVE fixed
  // point resolveHiddenFieldIds does server-side — a field whose trigger is
  // itself currently hidden is hidden too, its (stale) value never
  // consulted (treated as undefined).
  const inlineJs = `(function(){
  ${RULE_MATCH_JS}
  var rules = JSON.parse(document.getElementById('chq-field-rules').textContent);
  function getValue(id){
    var el = document.querySelector('[data-field-id="' + id + '"]');
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }
  function computeHidden(){
    var hidden = {};
    var changed = true;
    while (changed) {
      changed = false;
      rules.forEach(function(r){
        if (hidden[r.fieldId]) return;
        if (r.triggerKind === undefined) { hidden[r.fieldId] = true; changed = true; return; }
        var triggerHidden = !!hidden[r.rule.fieldId];
        var val = triggerHidden ? undefined : getValue(r.rule.fieldId);
        if (!chqRuleMatches(r.rule, val, r.triggerKind)) {
          hidden[r.fieldId] = true;
          changed = true;
        }
      });
    }
    return hidden;
  }
  function apply(){
    var hidden = computeHidden();
    rules.forEach(function(r){
      var wrap = document.getElementById('chq-field-wrap-' + r.fieldId);
      if (!wrap) return;
      var visible = !hidden[r.fieldId];
      wrap.style.display = visible ? '' : 'none';
      var input = wrap.querySelector('[data-field-id="' + r.fieldId + '"]');
      if (input) { input.required = visible && input.dataset.required === 'true'; }
    });
  }
  document.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', apply);
  apply();
  // DEC-909: live character counter for long-text fields with a budget --
  // fed by the same inline script, no separate bundle. Counts the DOM
  // textarea's current value (not a react-style controlled state), so it
  // stays correct across undo/paste/etc without a framework.
  function fmtThousands(n){ return n.toLocaleString('en-US'); }
  function updateCounters(){
    if (typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('[data-field-counter]').forEach(function(el){
      var fieldId = el.getAttribute('data-field-counter');
      var max = Number(el.getAttribute('data-max'));
      var input = document.querySelector('[data-field-id="' + fieldId + '"]');
      if (!input) return;
      var len = (input.value || '').length;
      el.textContent = fmtThousands(len) + ' / ' + fmtThousands(max);
    });
  }
  document.addEventListener('input', updateCounters);
  document.addEventListener('DOMContentLoaded', updateCounters);
  updateCounters();
})();`;
  return (
    <>
      <script type="application/json" id="chq-field-rules" dangerouslySetInnerHTML={{ __html: safeJson }} />
      <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
    </>
  );
}
