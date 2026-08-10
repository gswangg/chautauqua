import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FieldRulesScript } from "../src/views/form-render";

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

    expect(parsed).toEqual([{ fieldId: "materials", rule: { fieldId: "format", op: "eq", value: "Workshop" } }]);

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
});
