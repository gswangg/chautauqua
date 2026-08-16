import { describe, expect, it } from "vitest";
import { FORM_FIELD_KINDS, FORM_FIELD_RULE_OPS } from "../src/forms/types";
import { FIELD_KINDS as BUILDER_FIELD_KINDS } from "../src/forms/builder";
import { FIELD_KINDS, RULE_OPS, FIELD_KIND_LABELS } from "../app/src/pages/forms/types";

describe("CFP form-field vocabulary parity (DEC-615 wave-73)", () => {
  it("the SPA's FIELD_KINDS IS the domain FORM_FIELD_KINDS array (identity)", () => {
    expect(FIELD_KINDS).toBe(FORM_FIELD_KINDS);
  });

  it("the SPA's RULE_OPS IS the domain FORM_FIELD_RULE_OPS array (identity)", () => {
    expect(RULE_OPS).toBe(FORM_FIELD_RULE_OPS);
  });

  it("src/forms/builder.ts's FIELD_KINDS IS the same array object as the domain vocabulary", () => {
    expect(BUILDER_FIELD_KINDS).toBe(FORM_FIELD_KINDS);
  });

  it("FIELD_KIND_LABELS covers every member of the shared kind vocabulary", () => {
    for (const kind of FORM_FIELD_KINDS) {
      expect(FIELD_KIND_LABELS[kind]).toBeTruthy();
    }
    expect(Object.keys(FIELD_KIND_LABELS).sort()).toEqual([...FORM_FIELD_KINDS].sort());
  });
});
