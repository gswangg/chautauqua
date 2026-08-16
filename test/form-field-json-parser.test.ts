import { describe, expect, it } from "vitest";
import { FieldJsonError, parseFieldOptions, parseFieldRule } from "../src/forms/field-json";

describe("parseFieldOptions", () => {
  it("returns undefined for null/undefined/empty input", () => {
    expect(parseFieldOptions(null, "f1")).toBeUndefined();
    expect(parseFieldOptions(undefined, "f1")).toBeUndefined();
    expect(parseFieldOptions("", "f1")).toBeUndefined();
  });

  it("parses a valid array of strings", () => {
    expect(parseFieldOptions(JSON.stringify(["Talk", "Workshop"]), "f1")).toEqual(["Talk", "Workshop"]);
  });

  it("parses an empty array as an empty array, not undefined", () => {
    expect(parseFieldOptions(JSON.stringify([]), "f1")).toEqual([]);
  });

  it("throws a named FieldJsonError on invalid JSON", () => {
    expect(() => parseFieldOptions("{not json", "f1")).toThrow(FieldJsonError);
    expect(() => parseFieldOptions("{not json", "f1")).toThrow(/f1/);
    expect(() => parseFieldOptions("{not json", "f1")).toThrow(/options_json/);
  });

  it("throws on a non-array value", () => {
    expect(() => parseFieldOptions(JSON.stringify({ a: 1 }), "f1")).toThrow(FieldJsonError);
  });

  it("throws when array contains non-string members", () => {
    expect(() => parseFieldOptions(JSON.stringify(["a", 1, "b"]), "f1")).toThrow(FieldJsonError);
  });
});

describe("parseFieldRule", () => {
  it("returns undefined for null/undefined/empty input", () => {
    expect(parseFieldRule(null, "f1")).toBeUndefined();
    expect(parseFieldRule(undefined, "f1")).toBeUndefined();
    expect(parseFieldRule("", "f1")).toBeUndefined();
  });

  it("parses a valid eq rule", () => {
    expect(parseFieldRule(JSON.stringify({ fieldId: "format", op: "eq", value: "Talk" }), "f1")).toEqual({
      fieldId: "format",
      op: "eq",
      value: "Talk",
    });
  });

  it("parses a valid in rule with a string array value", () => {
    expect(
      parseFieldRule(JSON.stringify({ fieldId: "format", op: "in", value: ["Talk", "Workshop"] }), "f1"),
    ).toEqual({ fieldId: "format", op: "in", value: ["Talk", "Workshop"] });
  });

  it("throws a named FieldJsonError on invalid JSON", () => {
    expect(() => parseFieldRule("{not json", "f1")).toThrow(FieldJsonError);
    expect(() => parseFieldRule("{not json", "f1")).toThrow(/f1/);
    expect(() => parseFieldRule("{not json", "f1")).toThrow(/rule_json/);
  });

  it("throws when the parsed value is not an object", () => {
    expect(() => parseFieldRule(JSON.stringify(["a"]), "f1")).toThrow(FieldJsonError);
    expect(() => parseFieldRule(JSON.stringify("x"), "f1")).toThrow(FieldJsonError);
  });

  it("throws when fieldId is missing or empty", () => {
    expect(() => parseFieldRule(JSON.stringify({ op: "eq", value: "Talk" }), "f1")).toThrow(FieldJsonError);
    expect(() => parseFieldRule(JSON.stringify({ fieldId: "", op: "eq", value: "Talk" }), "f1")).toThrow(
      FieldJsonError,
    );
  });

  it("throws when op is missing or not a recognized op — this is the silent-hide bug's root cause", () => {
    expect(() => parseFieldRule(JSON.stringify({ fieldId: "format", value: "Talk" }), "f1")).toThrow(
      FieldJsonError,
    );
    expect(() =>
      parseFieldRule(JSON.stringify({ fieldId: "format", op: "gt", value: "Talk" }), "f1"),
    ).toThrow(FieldJsonError);
  });

  it("throws when value is absent", () => {
    expect(() => parseFieldRule(JSON.stringify({ fieldId: "format", op: "eq" }), "f1")).toThrow(FieldJsonError);
  });

  it("throws when op is 'in' but value is not an array of strings", () => {
    expect(() =>
      parseFieldRule(JSON.stringify({ fieldId: "format", op: "in", value: "Talk" }), "f1"),
    ).toThrow(FieldJsonError);
    expect(() =>
      parseFieldRule(JSON.stringify({ fieldId: "format", op: "in", value: [1, 2] }), "f1"),
    ).toThrow(FieldJsonError);
  });
});
