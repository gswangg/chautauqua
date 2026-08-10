// Shared form renderer (owned by w2-d): renders FormFieldDef[] + AnswerMap
// to hono/jsx inputs, plus a JSON script + ~30 lines of inline vanilla JS
// implementing DEC-008 show/hide toggling for fields with a `rule`. The
// server always revalidates regardless (src/forms/validate.ts) — this is
// progressive enhancement only, never the source of truth.

import type { FormFieldDef, AnswerMap } from "../forms/types";
import { ALLOWED_UPLOAD_EXTENSIONS, uploadHintText } from "../domain/files";

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
          id={name}
          name={name}
          data-field-id={field.id}
          value={typeof value === "string" ? value : ""}
          required={field.required}
        />
      );
    case "long_text":
      return (
        <textarea id={name} name={name} data-field-id={field.id} required={field.required}>
          {typeof value === "string" ? value : ""}
        </textarea>
      );
    case "dropdown":
      return (
        <select id={name} name={name} data-field-id={field.id} required={field.required}>
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
          id={name}
          name={name}
          data-field-id={field.id}
          value={typeof value === "number" ? String(value) : ""}
          required={field.required}
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

/** One labeled field, wrapped in the div the visibility script toggles. */
export function FormField(props: { field: FormFieldDef; value: unknown; error?: string; visible: boolean }) {
  const { field, value, error, visible } = props;
  return (
    <div id={wrapId(field.id)} style={visible ? undefined : "display:none"}>
      <label>
        {field.label}
        {field.required ? " *" : ""}
        <FieldControl field={field} value={value} />
      </label>
      {field.helpText ? <p class="help">{field.helpText}</p> : null}
      {field.kind === "file" ? <p class="help">{uploadHintText()}</p> : null}
      {error ? (
        <p role="alert" class="field-error">
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
  const rules = props.fields
    .filter((f) => f.rule)
    .map((f) => ({ fieldId: f.id, rule: f.rule }));
  const json = JSON.stringify(rules);
  const inlineJs = `(function(){
  var rules = JSON.parse(document.getElementById('chq-field-rules').textContent);
  function getValue(id){
    var el = document.querySelector('[data-field-id="' + id + '"]');
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }
  function matches(rule, val){
    if (rule.op === 'eq') return val === rule.value;
    if (rule.op === 'ne') return val !== rule.value;
    if (rule.op === 'in') return Array.isArray(rule.value) && rule.value.indexOf(val) !== -1;
    return true;
  }
  function apply(){
    rules.forEach(function(r){
      var wrap = document.getElementById('chq-field-wrap-' + r.fieldId);
      if (!wrap) return;
      var visible = matches(r.rule, getValue(r.rule.fieldId));
      wrap.style.display = visible ? '' : 'none';
      var input = wrap.querySelector('[data-field-id="' + r.fieldId + '"]');
      if (input) { input.required = visible && input.dataset.required === 'true'; }
    });
  }
  document.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', apply);
  apply();
})();`;
  return (
    <>
      <script type="application/json" id="chq-field-rules">
        {json}
      </script>
      <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
    </>
  );
}
