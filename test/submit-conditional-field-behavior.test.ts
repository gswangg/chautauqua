// w43-e / DEC-532 amendment: the public CFP form must actually toggle a
// rule-gated field's visibility as the visitor answers, not just decide it
// once at GET against an empty answer map. This asserts the mechanism the
// public submit page (src/routes/public/submit-views.tsx) actually ships —
// FormField always renders the rule-bearing field's wrapper (never omits
// it), marking it hidden via an inline style, and FieldRulesScript emits a
// JSON blob of every field's {fieldId, rule, triggerKind} plus a toggler
// script that re-evaluates the DEC-532/DEC-973 transitive fixed point on
// every 'change'/'input' and wires up on DOMContentLoaded — see
// test/form-render-rules.test.ts for the fixed-point toggling proof running
// the actual emitted script against a fake `document`. This file checks the
// two things w43-e's brief called out specifically: (1) a rule-hidden field
// is present in the SSR markup (never omitted) and (2) a locked field
// (DEC-625) can never carry a rule, so it never shows up in the toggler's
// rule set regardless of what a producer/API caller tries to attach.
import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FieldRulesScript, FormField } from "../src/views/form-render";
import { resolveHiddenFieldIds } from "../src/forms/visibility";
import { FormatChoices, AudienceChoices } from "../src/routes/public/submit-views";

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 0,
  options: ["Talk", "Workshop"],
};

const prereqsField: FormFieldDef = {
  id: "prereqs",
  section: "session",
  kind: "long_text",
  label: "Workshop prerequisites",
  required: false,
  position: 1,
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

describe("public CFP conditional field: present-but-hidden markup + client toggle wiring (DEC-532 wave-43 amendment)", () => {
  it("a rule-hidden field's wrapper is emitted (not omitted) with a hidden style, its label/control still in the DOM", () => {
    const answers = { format: "Talk" }; // dependent's rule evaluates false
    const hidden = resolveHiddenFieldIds([formatField, prereqsField], answers);
    expect(hidden.has("prereqs")).toBe(true);

    const html = FormField({
      field: prereqsField,
      value: undefined,
      visible: !hidden.has("prereqs"),
    }).toString();

    // present: the label text and the textarea both ship in the response
    expect(html).toContain("Workshop prerequisites");
    expect(html).toContain('data-field-id="prereqs"');
    // hidden: the wrapper carries the display:none the client toggles
    expect(html).toContain('id="chq-field-wrap-prereqs"');
    expect(html).toContain("display:none");
  });

  it("switching the trigger back to 'Workshop' flips the same field visible", () => {
    const answers = { format: "Workshop" };
    const hidden = resolveHiddenFieldIds([formatField, prereqsField], answers);
    expect(hidden.has("prereqs")).toBe(false);

    const html = FormField({
      field: prereqsField,
      value: undefined,
      visible: !hidden.has("prereqs"),
    }).toString();
    expect(html).not.toContain("display:none");
  });

  it("the toggler script's rule set (consumed by FieldRulesScript's inline JS on every change/input, DOMContentLoaded) carries the dependent's rule", () => {
    const html = FieldRulesScript({ fields: [formatField, prereqsField] }).toString();
    const match = html.match(/<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/);
    if (!match || match[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const rules = JSON.parse(match[1]);
    expect(rules).toEqual([
      { fieldId: "prereqs", rule: { fieldId: "format", op: "eq", value: "Workshop" }, triggerKind: "dropdown" },
    ]);
    // Wired to re-run on every input/change, not just once at load.
    expect(html).toContain("document.addEventListener('change', apply)");
    expect(html).toContain("document.addEventListener('DOMContentLoaded', apply)");
  });

  it("a locked field (DEC-625) can never carry a rule, so it is never in the toggler's rule set even if a caller tries to attach one", () => {
    const lockedTitle: FormFieldDef = {
      // DEC-050: an unprefixed id ('title') is a valid locked-field
      // reference too — lockedFieldName checks it as-is when there's no
      // ':' — so this exercises the same guard a real seeded default-form
      // row would hit.
      id: "title",
      section: "session",
      kind: "text",
      label: "Title",
      required: true,
      position: 0,
      // A locked field's FormFieldDef type permits `rule` structurally, but
      // DEC-625 forbids the API from ever persisting one on a locked row
      // (src/routes/api/forms.ts:226). Simulate a caller that bypassed that
      // guard to prove the RENDERER also never surfaces it to the client.
      rule: { fieldId: "format", op: "eq", value: "Workshop" },
    };
    const html = FieldRulesScript({ fields: [formatField, lockedTitle] }).toString();
    const match = html.match(/<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/);
    if (!match || match[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const rules = JSON.parse(match[1]);
    expect(rules).toEqual([]);

    // And resolveHiddenFieldIds — the server-side twin the client mirrors —
    // never hides the locked field either.
    const hidden = resolveHiddenFieldIds([formatField, lockedTitle], { format: "Talk" });
    expect(hidden.has(lockedTitle.id)).toBe(false);
  });
});

// w54-e (P1 fix): FormatChoices/AudienceChoices render every radio option
// under the same data-field-id (getValue is fixed to be radio-group aware in
// form-render-rules.test.ts) but, before this fix, emitted no
// chq-field-wrap-<fieldId> element at all — so a rule ON one of these
// pulled-out fields could never be toggled/hidden in the browser, since
// FieldRulesScript's apply() looks the wrap up by id and silently no-ops
// when it's missing.
describe("FormatChoices/AudienceChoices carry the toggler's wrap id + data-required (w54-e)", () => {
  const audienceField: FormFieldDef = {
    id: "audience_level",
    section: "session",
    kind: "dropdown",
    label: "Audience level",
    required: true,
    position: 0,
    options: ["Beginner", "Intermediate", "Advanced"],
  };

  it("FormatChoices wraps its fieldset in chq-field-wrap-<fieldId> and marks options data-required", () => {
    const html = FormatChoices({ field: formatField, value: undefined, visible: true }).toString();
    expect(html).toContain(`id="chq-field-wrap-${formatField.id}"`);
    expect(html).toContain('data-required="true"');
    expect(html).not.toContain("display:none");
  });

  it("FormatChoices renders display:none inline when not visible", () => {
    const html = FormatChoices({ field: formatField, value: undefined, visible: false }).toString();
    expect(html).toContain(`id="chq-field-wrap-${formatField.id}"`);
    expect(html).toContain("display:none");
  });

  it("AudienceChoices wraps its fieldset in chq-field-wrap-<fieldId> and marks options data-required", () => {
    const html = AudienceChoices({ field: audienceField, value: undefined, visible: true }).toString();
    expect(html).toContain(`id="chq-field-wrap-${audienceField.id}"`);
    expect(html).toContain('data-required="true"');
    expect(html).not.toContain("display:none");
  });

  it("AudienceChoices renders display:none inline when not visible", () => {
    const html = AudienceChoices({ field: audienceField, value: undefined, visible: false }).toString();
    expect(html).toContain(`id="chq-field-wrap-${audienceField.id}"`);
    expect(html).toContain("display:none");
  });
});
