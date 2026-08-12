import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FieldRulesScript, FormField, FormFieldsSection } from "../src/views/form-render";
import { RULE_MATCH_JS, RULE_MATCH_CASES, ruleMatches } from "../src/forms/rule-match";

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
    const wrapB = { style: { display: "" }, querySelector: () => inputB };
    const wrapC = { style: { display: "" }, querySelector: () => inputC };

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
});
