import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { isPermutation, validateFieldDefInput, validateRuleReference } from "../src/forms/builder";

const titleField: FormFieldDef = {
  id: "title",
  section: "session",
  kind: "text",
  label: "Title",
  required: true,
  position: 0,
};

const formatField: FormFieldDef = {
  id: "format",
  section: "session",
  kind: "dropdown",
  label: "Format",
  required: true,
  position: 1,
  options: ["Talk", "Workshop"],
};

const materialsField: FormFieldDef = {
  id: "materials",
  section: "session",
  kind: "text",
  label: "Materials",
  required: false,
  position: 2,
  rule: { fieldId: "format", op: "eq", value: "Workshop" },
};

describe("validateFieldDefInput", () => {
  it("accepts a well-formed text field", () => {
    const result = validateFieldDefInput(
      { section: "session", kind: "text", label: "Abstract", required: true },
      [titleField],
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a kind outside the six literals", () => {
    const result = validateFieldDefInput({ kind: "date" }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.kind).toBeDefined();
  });

  it("requires options for dropdown fields", () => {
    const result = validateFieldDefInput({ kind: "dropdown", label: "Format" }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeDefined();
  });

  it("rejects dropdown with an empty options array", () => {
    const result = validateFieldDefInput({ kind: "dropdown", label: "Format", options: [] }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.options).toBeDefined();
  });

  it("accepts dropdown with a non-empty string options array", () => {
    const result = validateFieldDefInput(
      { kind: "dropdown", label: "Format", options: ["Talk", "Workshop"] },
      [titleField],
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a blank label", () => {
    const result = validateFieldDefInput({ label: "   " }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.label).toBeDefined();
  });

  it("rejects a rule referencing a field id that doesn't exist on the form", () => {
    const result = validateFieldDefInput(
      { rule: { fieldId: "nonexistent", op: "eq", value: "x" } },
      [titleField, formatField],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.rule).toBeDefined();
  });

  it("accepts a rule referencing an existing sibling field", () => {
    const result = validateFieldDefInput(
      { rule: { fieldId: "format", op: "eq", value: "Workshop" } },
      [titleField, formatField],
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateRuleReference", () => {
  it("rejects an unknown rule op", () => {
    const err = validateRuleReference(
      { fieldId: "format", op: "gte" as never, value: 1 },
      [formatField],
    );
    expect(err).toBeDefined();
  });

  it("rejects a field referencing its own id (immediate self-cycle)", () => {
    const err = validateRuleReference({ fieldId: "materials", op: "eq", value: "x" }, [materialsField], "materials");
    expect(err).toBeDefined();
  });

  it("rejects op 'in' whose value is not an array", () => {
    const err = validateRuleReference({ fieldId: "format", op: "in", value: "Workshop" }, [formatField]);
    expect(err).toBeDefined();
  });

  it("detects a two-hop visibility cycle (A depends on B, B would depend on A)", () => {
    // materials.rule already points at format. If we now try to set
    // format's rule to point at materials, that's a cycle: format -> materials -> format.
    const err = validateRuleReference(
      { fieldId: "materials", op: "eq", value: "x" },
      [materialsField, formatField],
      "format",
    );
    expect(err).toBe("rule would create a visibility cycle");
  });

  it("allows a rule referencing a field with no rule chain back to self", () => {
    const err = validateRuleReference({ fieldId: "format", op: "eq", value: "Workshop" }, [formatField], "materials");
    expect(err).toBeUndefined();
  });
});

describe("isPermutation (reorder)", () => {
  const ids = ["a", "b", "c"];

  it("accepts a full permutation in any order", () => {
    expect(isPermutation(ids, ["c", "a", "b"])).toBe(true);
  });

  it("rejects a shorter list (missing an id)", () => {
    expect(isPermutation(ids, ["a", "b"])).toBe(false);
  });

  it("rejects a longer list (extra id)", () => {
    expect(isPermutation(ids, ["a", "b", "c", "d"])).toBe(false);
  });

  it("rejects duplicate ids", () => {
    expect(isPermutation(ids, ["a", "a", "c"])).toBe(false);
  });

  it("rejects an id not belonging to the form", () => {
    expect(isPermutation(ids, ["a", "b", "z"])).toBe(false);
  });

  it("rejects a non-array payload", () => {
    expect(isPermutation(ids, "not-an-array")).toBe(false);
  });
});
