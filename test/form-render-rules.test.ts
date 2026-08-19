import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FieldRulesScript, FormField, FormFieldsSection } from "../src/views/form-render";
import {
  RULE_MATCH_JS,
  RULE_MATCH_CASES,
  RULE_MATCH_THROW_CASES,
  ruleMatches,
} from "../src/forms/rule-match";

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 0,
  options: ["Talk", "Workshop"],
};

const materialsField: FormFieldDef = {
  id: "materials",
  section: "session",
  kind: "text",
  label: "Materials needed",
  required: true,
  position: 1,
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

function extractRulesJson(html: string): string {
  const match = html.match(
    /<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/,
  );
  if (!match || match[1] === undefined) {
    throw new Error("chq-field-rules script tag not found in rendered HTML");
  }
  return match[1];
}

describe("FieldRulesScript", () => {
  it("round-trips fieldId/rule through valid JSON with no HTML-entity escaping", () => {
    const html = FieldRulesScript({ fields: [formatField, materialsField] }).toString();

    const rulesJson = extractRulesJson(html);
    const parsed = JSON.parse(rulesJson);

    expect(parsed).toEqual([
      {
        fieldId: "materials",
        rule: { fieldId: "format", op: "eq", value: "Workshop" },
        triggerKind: "dropdown",
      },
    ]);

    // DEC-110: must be raw JSON via dangerouslySetInnerHTML, not JSX-escaped
    // text (which would turn quotes into &quot; entities and break JSON.parse
    // via textContent in the browser too, since &quot; only decodes for HTML
    // parsing of attributes/text — the historical CFP-03 bug).
    expect(rulesJson).not.toContain("&quot;");
  });

  it("does not let a rule value terminate the script element early", () => {
    const maliciousField: FormFieldDef = {
      id: "notes",
      section: "session",
      kind: "text",
      label: "Notes",
      required: false,
      position: 2,
      rule: { fieldId: "format", op: "eq", value: "</script><script>alert(1)</script>" },
    };

    const html = FieldRulesScript({ fields: [maliciousField] }).toString();
    const rulesJson = extractRulesJson(html);
    const parsed = JSON.parse(rulesJson);

    expect(parsed[0].rule.value).toBe("</script><script>alert(1)</script>");
    // The literal '<' is escaped as < so '</script>' does not appear
    // literally inside the script body, keeping the element from closing
    // early — but the JSON-decoded value round-trips to the real string.
    expect(rulesJson).not.toContain("</script>");
  });

  it("emits the exact dataset.required contract string the inline script relies on (DEC-194)", () => {
    const html = FieldRulesScript({ fields: [formatField, materialsField] }).toString();
    expect(html).toContain("input.dataset.required === 'true'");
  });
});

describe("FieldControl data-required attribute (DEC-008/DEC-194)", () => {
  it("a required text field renders data-required=\"true\" alongside required", () => {
    const html = FormField({ field: materialsField, value: undefined, visible: true }).toString();
    expect(html).toContain('data-required="true"');
    expect(html).toContain("required");
  });

  it("an optional field renders data-required=\"false\"", () => {
    const optionalField: FormFieldDef = {
      id: "notes2",
      section: "session",
      kind: "text",
      label: "Notes",
      required: false,
      position: 3,
    };
    const html = FormField({ field: optionalField, value: undefined, visible: true }).toString();
    expect(html).toContain('data-required="false"');
  });

  it("a rule-gated required dropdown keeps both required and data-required=\"true\" when visible", () => {
    const gatedRequiredDropdown: FormFieldDef = {
      id: "workshopLevel",
      section: "session",
      kind: "dropdown",
      label: "Workshop level",
      required: true,
      position: 4,
      options: ["Beginner", "Advanced"],
      rule: { fieldId: "format", op: "eq", value: "Workshop" },
    };
    const html = FormFieldsSection({
      fields: [formatField, gatedRequiredDropdown],
      section: "session",
      answers: { format: "Workshop" },
      isVisible: () => true,
    }).toString();
    expect(html).toContain('data-required="true"');
    expect(html).toMatch(/<select[^>]*\brequired\b/);
  });
});

describe("RULE_MATCH_JS parity with ruleMatches (DEC-681)", () => {
  it("chqRuleMatches agrees with the server's ruleMatches on every shared case", () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const chqRuleMatches = new Function(
      `${RULE_MATCH_JS}\nreturn chqRuleMatches;`,
    )() as (rule: unknown, value: unknown, kind: string) => boolean;

    for (const { kind, answer, rule, expected } of RULE_MATCH_CASES) {
      expect(chqRuleMatches(rule, answer, kind)).toBe(expected);
      expect(ruleMatches(rule, answer, kind)).toBe(expected);
    }
  });

  it("chqRuleMatches and ruleMatches BOTH throw on every refusal case (DEC-681 wave-38 amendment)", () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const chqRuleMatches = new Function(
      `${RULE_MATCH_JS}\nreturn chqRuleMatches;`,
    )() as (rule: unknown, value: unknown, kind: string) => boolean;

    expect(RULE_MATCH_THROW_CASES.length).toBeGreaterThan(0);
    for (const { kind, answer, rule } of RULE_MATCH_THROW_CASES) {
      expect(() => chqRuleMatches(rule, answer, kind)).toThrow();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => ruleMatches(rule as any, answer, kind as any)).toThrow();
    }
  });
});

describe("FieldRulesScript emits a transitive fixed point for a chain (DEC-681/DEC-532)", () => {
  it("hides C when B is hidden, even though C's own trigger value would otherwise match", () => {
    const a: FormFieldDef = {
      id: "a",
      section: "session",
      kind: "dropdown",
      label: "A",
      required: true,
      position: 0,
      options: ["yes", "no"],
    };
    const b: FormFieldDef = {
      id: "b",
      section: "session",
      kind: "dropdown",
      label: "B",
      required: true,
      position: 1,
      options: ["yes", "no"],
      rule: { fieldId: "a", op: "eq", value: "yes" },
    };
    const c: FormFieldDef = {
      id: "c",
      section: "session",
      kind: "text",
      label: "C",
      required: true,
      position: 2,
      rule: { fieldId: "b", op: "eq", value: "yes" },
    };

    const html = FieldRulesScript({ fields: [a, b, c] }).toString();
    const match = html.match(
      /<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/,
    );
    if (!match || match[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const rules = JSON.parse(match[1]);
    expect(rules).toEqual([
      { fieldId: "b", rule: { fieldId: "a", op: "eq", value: "yes" }, triggerKind: "dropdown" },
      { fieldId: "c", rule: { fieldId: "b", op: "eq", value: "yes" }, triggerKind: "dropdown" },
    ]);

    // Simulate the browser: a = 'no' (so b's own rule fails -> b hidden),
    // but b's stale DOM value is still 'yes' (the value c's rule targets).
    // The fixed point must hide c too, not just evaluate c's rule directly
    // against b's stale value. A minimal fake `document` (no jsdom in this
    // plain .test.ts environment) is enough to run the actual emitted IIFE.
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*$/);
    if (!scriptMatch || scriptMatch[1] === undefined) throw new Error("inline script not found");
    const inlineJs = scriptMatch[1];

    function makeInput(fieldId: string, value: string) {
      return { dataset: { fieldId, required: "true" }, type: "text", value, required: false };
    }
    const rulesScriptEl = { textContent: match[1] };
    const inputA = makeInput("a", "no");
    const inputB = makeInput("b", "yes"); // stale: still shows the value from when it was visible
    const inputC = makeInput("c", "irrelevant");
    const wrapB = { style: { display: "" }, querySelector: () => inputB, querySelectorAll: () => [inputB] };
    const wrapC = { style: { display: "" }, querySelector: () => inputC, querySelectorAll: () => [inputC] };

    const byId: Record<string, unknown> = {
      "chq-field-rules": rulesScriptEl,
      "chq-field-wrap-b": wrapB,
      "chq-field-wrap-c": wrapC,
    };
    const bySelector: Record<string, unknown> = {
      '[data-field-id="a"]': inputA,
      '[data-field-id="b"]': inputB,
      '[data-field-id="c"]': inputC,
    };
    function querySelector(sel: string) {
      return bySelector[sel] ?? null;
    }

    const fakeDocument = {
      getElementById: (id: string) => byId[id] ?? null,
      querySelector,
      addEventListener: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);

    expect(wrapB.style.display).toBe("none");
    expect(wrapC.style.display).toBe("none");
    expect(inputC.required).toBe(false);
  });

  it("hides a dependent whose rule targets a hidden checkbox trigger, even though the trigger's stale unchecked state would otherwise satisfy ne:true (DEC-973)", () => {
    const gate: FormFieldDef = {
      id: "gate",
      section: "session",
      kind: "dropdown",
      label: "Gate",
      required: false,
      position: 0,
      options: ["Open", "Closed"],
    };
    const trigger: FormFieldDef = {
      id: "trigger",
      section: "session",
      kind: "checkbox",
      label: "Trigger",
      required: false,
      position: 1,
      rule: { fieldId: "gate", op: "eq", value: "Open" },
    };
    const dependent: FormFieldDef = {
      id: "dependent",
      section: "session",
      kind: "text",
      label: "Dependent",
      required: true,
      position: 2,
      rule: { fieldId: "trigger", op: "ne", value: true },
    };

    const html = FieldRulesScript({ fields: [gate, trigger, dependent] }).toString();
    const match = html.match(
      /<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/,
    );
    if (!match || match[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*$/);
    if (!scriptMatch || scriptMatch[1] === undefined) throw new Error("inline script not found");
    const inlineJs = scriptMatch[1];

    function makeInput(fieldId: string, extra: Record<string, unknown>) {
      return { dataset: { fieldId, required: "true" }, required: false, ...extra };
    }
    const rulesScriptEl = { textContent: match[1] };
    const inputGate = makeInput("gate", { type: "text", value: "Closed" });
    // Stale: trigger's checkbox is unchecked, which would satisfy ne:true
    // directly — the fixed point must still hide dependent because trigger
    // itself is hidden (gate !== "Open").
    const inputTrigger = makeInput("trigger", { type: "checkbox", checked: false });
    const inputDependent = makeInput("dependent", { type: "text", value: "irrelevant" });
    const wrapTrigger = { style: { display: "" }, querySelector: () => inputTrigger, querySelectorAll: () => [inputTrigger] };
    const wrapDependent = { style: { display: "" }, querySelector: () => inputDependent, querySelectorAll: () => [inputDependent] };

    const byId: Record<string, unknown> = {
      "chq-field-rules": rulesScriptEl,
      "chq-field-wrap-trigger": wrapTrigger,
      "chq-field-wrap-dependent": wrapDependent,
    };
    const bySelector: Record<string, unknown> = {
      '[data-field-id="gate"]': inputGate,
      '[data-field-id="trigger"]': inputTrigger,
      '[data-field-id="dependent"]': inputDependent,
    };
    function querySelector(sel: string) {
      return bySelector[sel] ?? null;
    }

    const fakeDocument = {
      getElementById: (id: string) => byId[id] ?? null,
      querySelector,
      addEventListener: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);

    expect(wrapTrigger.style.display).toBe("none");
    expect(wrapDependent.style.display).toBe("none");
    expect(inputDependent.required).toBe(false);
  });

  it("keeps a dependent visible when its checkbox trigger is visible and unanswered (unchanged absent-checkbox=>false canonicalizer)", () => {
    const gate: FormFieldDef = {
      id: "gate",
      section: "session",
      kind: "dropdown",
      label: "Gate",
      required: false,
      position: 0,
      options: ["Open", "Closed"],
    };
    const trigger: FormFieldDef = {
      id: "trigger",
      section: "session",
      kind: "checkbox",
      label: "Trigger",
      required: false,
      position: 1,
      rule: { fieldId: "gate", op: "eq", value: "Open" },
    };
    const dependent: FormFieldDef = {
      id: "dependent",
      section: "session",
      kind: "text",
      label: "Dependent",
      required: true,
      position: 2,
      rule: { fieldId: "trigger", op: "ne", value: true },
    };

    const html = FieldRulesScript({ fields: [gate, trigger, dependent] }).toString();
    const match = html.match(
      /<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/,
    );
    if (!match || match[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*$/);
    if (!scriptMatch || scriptMatch[1] === undefined) throw new Error("inline script not found");
    const inlineJs = scriptMatch[1];

    function makeInput(fieldId: string, extra: Record<string, unknown>) {
      return { dataset: { fieldId, required: "true" }, required: false, ...extra };
    }
    const rulesScriptEl = { textContent: match[1] };
    const inputGate = makeInput("gate", { type: "text", value: "Open" });
    // trigger is visible (gate === "Open") but unanswered — no DOM element
    // for it yet, so getValue returns undefined; the canonicalizer treats an
    // absent checkbox as false, and ne:true against false is true.
    const inputDependent = makeInput("dependent", { type: "text", value: "irrelevant" });
    const wrapTrigger = { style: { display: "" }, querySelector: () => null, querySelectorAll: () => [] };
    const wrapDependent = { style: { display: "" }, querySelector: () => inputDependent, querySelectorAll: () => [inputDependent] };

    const byId: Record<string, unknown> = {
      "chq-field-rules": rulesScriptEl,
      "chq-field-wrap-trigger": wrapTrigger,
      "chq-field-wrap-dependent": wrapDependent,
    };
    const bySelector: Record<string, unknown> = {
      '[data-field-id="gate"]': inputGate,
      '[data-field-id="dependent"]': inputDependent,
    };
    function querySelector(sel: string) {
      return bySelector[sel] ?? null;
    }

    const fakeDocument = {
      getElementById: (id: string) => byId[id] ?? null,
      querySelector,
      addEventListener: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);

    expect(wrapTrigger.style.display).toBe("");
    expect(wrapDependent.style.display).toBe("");
    expect(inputDependent.required).toBe(true);
  });
});

// w54-e (P1 fix): a radio-group trigger — every option shares the same
// data-field-id (FormatChoices/AudienceChoices, src/routes/public/
// submit-views.tsx), so getValue must find the CHECKED member, not just the
// first DOM match querySelector would hand back.
describe("getValue is radio-group aware (w54-e)", () => {
  const format: FormFieldDef = {
    id: "format",
    section: "session",
    kind: "dropdown",
    label: "Format",
    required: true,
    position: 0,
    options: ["Talk", "Workshop"],
  };
  const materials: FormFieldDef = {
    id: "materials",
    section: "session",
    kind: "text",
    label: "Materials needed",
    required: true,
    position: 1,
    rule: { fieldId: "format", op: "eq", value: "Workshop" },
  };

  function buildFakeDocument(radioValues: { value: string; checked: boolean }[]) {
    const html = FieldRulesScript({ fields: [format, materials] }).toString();
    const rulesMatch = html.match(
      /<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/,
    );
    if (!rulesMatch || rulesMatch[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*$/);
    if (!scriptMatch || scriptMatch[1] === undefined) throw new Error("inline script not found");
    const inlineJs = scriptMatch[1];

    const radioEls = radioValues.map((r) => ({
      dataset: { fieldId: "format" },
      type: "radio",
      value: r.value,
      checked: r.checked,
    }));
    const materialsInput = { dataset: { fieldId: "materials", required: "true" }, type: "text", value: "", required: false };
    const wrapMaterials = { style: { display: "" }, querySelector: () => materialsInput, querySelectorAll: () => [materialsInput] };

    const byId: Record<string, unknown> = {
      "chq-field-rules": { textContent: rulesMatch[1] },
      "chq-field-wrap-materials": wrapMaterials,
    };
    function querySelector(sel: string) {
      if (sel === '[data-field-id="format"]') return radioEls[0] ?? null;
      if (sel === '[data-field-id="materials"]') return materialsInput;
      return null;
    }
    function querySelectorAll(sel: string) {
      if (sel === '[data-field-id="format"]') return radioEls;
      return [];
    }
    const fakeDocument = {
      getElementById: (id: string) => byId[id] ?? null,
      querySelector,
      querySelectorAll,
      addEventListener: () => {},
    };
    return { inlineJs, fakeDocument, wrapMaterials, materialsInput };
  }

  it("second option checked -> dependent field visible", () => {
    const { inlineJs, fakeDocument, wrapMaterials, materialsInput } = buildFakeDocument([
      { value: "Talk", checked: false },
      { value: "Workshop", checked: true },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);
    expect(wrapMaterials.style.display).toBe("");
    expect(materialsInput.required).toBe(true);
  });

  it("nothing checked -> dependent field hidden", () => {
    const { inlineJs, fakeDocument, wrapMaterials, materialsInput } = buildFakeDocument([
      { value: "Talk", checked: false },
      { value: "Workshop", checked: false },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);
    expect(wrapMaterials.style.display).toBe("none");
    expect(materialsInput.required).toBe(false);
  });

  it("first option checked but rule wants the second -> dependent field hidden", () => {
    const { inlineJs, fakeDocument, wrapMaterials, materialsInput } = buildFakeDocument([
      { value: "Talk", checked: true },
      { value: "Workshop", checked: false },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);
    expect(wrapMaterials.style.display).toBe("none");
    expect(materialsInput.required).toBe(false);
  });
});

// DEC-986: a Format/Audience group renders N radios sharing one
// data-field-id (FormatChoices/AudienceChoices). When that group's own wrap
// is hidden, EVERY radio in it -- not just the first DOM match -- must be
// un-required, or radios 2..N stay required inside a display:none wrap and
// the browser aborts submission on a non-focusable invalid control.
describe("apply() un-requires every member of a hidden radio group, not just the first (DEC-986)", () => {
  const gate: FormFieldDef = {
    id: "gate",
    section: "session",
    kind: "dropdown",
    label: "Gate",
    required: false,
    position: 0,
    options: ["Open", "Closed"],
  };
  const audience: FormFieldDef = {
    id: "audience",
    section: "session",
    kind: "dropdown",
    label: "Audience",
    required: true,
    position: 1,
    rule: { fieldId: "gate", op: "eq", value: "Open" },
  };

  function buildFakeDocument(gateValue: string) {
    const html = FieldRulesScript({ fields: [gate, audience] }).toString();
    const rulesMatch = html.match(
      /<script type="application\/json" id="chq-field-rules">([\s\S]*?)<\/script>/,
    );
    if (!rulesMatch || rulesMatch[1] === undefined) throw new Error("chq-field-rules script tag not found");
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*$/);
    if (!scriptMatch || scriptMatch[1] === undefined) throw new Error("inline script not found");
    const inlineJs = scriptMatch[1];

    const inputGate = { dataset: { fieldId: "gate" }, type: "text", value: gateValue, required: false };
    // Three radios sharing data-field-id="audience", as FormatChoices /
    // AudienceChoices actually render -- all three carry required=true
    // going in, exercising the querySelectorAll fix over the old singular
    // querySelector (which only ever reached radioA).
    const radioA = { dataset: { fieldId: "audience", required: "true" }, type: "radio", value: "Devs", checked: false, required: true };
    const radioB = { dataset: { fieldId: "audience", required: "true" }, type: "radio", value: "Ops", checked: false, required: true };
    const radioC = { dataset: { fieldId: "audience", required: "true" }, type: "radio", value: "Exec", checked: false, required: true };
    const radios = [radioA, radioB, radioC];
    const wrapAudience = {
      style: { display: "" },
      querySelector: () => radioA,
      querySelectorAll: (sel: string) => (sel === '[data-field-id="audience"]' ? radios : []),
    };

    const byId: Record<string, unknown> = {
      "chq-field-rules": { textContent: rulesMatch[1] },
      "chq-field-wrap-audience": wrapAudience,
    };
    function querySelector(sel: string) {
      if (sel === '[data-field-id="gate"]') return inputGate;
      if (sel === '[data-field-id="audience"]') return radioA;
      return null;
    }
    const fakeDocument = {
      getElementById: (id: string) => byId[id] ?? null,
      querySelector,
      addEventListener: () => {},
    };
    return { inlineJs, fakeDocument, wrapAudience, radioA, radioB, radioC };
  }

  it("hides the group and un-requires all three radios, not just the first", () => {
    const { inlineJs, fakeDocument, wrapAudience, radioA, radioB, radioC } = buildFakeDocument("Closed");
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);
    expect(wrapAudience.style.display).toBe("none");
    expect(radioA.required).toBe(false);
    expect(radioB.required).toBe(false);
    expect(radioC.required).toBe(false);
  });

  it("shows the group and keeps all three radios required when visible", () => {
    const { inlineJs, fakeDocument, wrapAudience, radioA, radioB, radioC } = buildFakeDocument("Open");
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function("document", inlineJs)(fakeDocument);
    expect(wrapAudience.style.display).toBe("");
    expect(radioA.required).toBe(true);
    expect(radioB.required).toBe(true);
    expect(radioC.required).toBe(true);
  });
});
