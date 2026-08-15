// DEC-561 (Amendment, wave 60): owner tests, carrying forward the cases from
// the four deleted copies (app/src/pages/review/answerText.test.ts,
// app/src/pages/submissions/columns.test.ts's formatAnswerValue block, plus
// the response-detail and export renderers' implied behavior) and adding
// tests for the divergences the ruling closes.
import { describe, expect, it } from "vitest";
import { answerDisplayText, answerExportCell } from "../src/domain/answer-text";

describe("answerDisplayText", () => {
  it("passes strings through unchanged", () => {
    expect(answerDisplayText("hello world")).toBe("hello world");
  });

  it("stringifies numbers", () => {
    expect(answerDisplayText(42)).toBe("42");
    expect(answerDisplayText(0)).toBe("0");
  });

  it("renders booleans as Yes/No", () => {
    expect(answerDisplayText(true)).toBe("Yes");
    expect(answerDisplayText(false)).toBe("No");
  });

  it("joins arrays with ', ', recursing on each element", () => {
    expect(answerDisplayText(["python", "rust", "go"])).toBe("python, rust, go");
    expect(answerDisplayText([true, false, 3])).toBe("Yes, No, 3");
  });

  it("renders null, undefined, and empty string as the default empty token ('')", () => {
    expect(answerDisplayText(null)).toBe("");
    expect(answerDisplayText(undefined)).toBe("");
    expect(answerDisplayText("")).toBe("");
  });

  it("honors a caller-declared empty token, e.g. the Scorecard's em dash", () => {
    expect(answerDisplayText(null, { empty: "—" })).toBe("—");
    expect(answerDisplayText(undefined, { empty: "—" })).toBe("—");
    expect(answerDisplayText("", { empty: "—" })).toBe("—");
  });

  it("JSON.stringifies a plain object -- never '[object Object]'", () => {
    expect(answerDisplayText({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
    expect(answerDisplayText({ a: 1 })).not.toBe("[object Object]");
  });
});

describe("answerExportCell", () => {
  it("passes strings and numbers through String(value)", () => {
    expect(answerExportCell("hello")).toBe("hello");
    expect(answerExportCell(42)).toBe("42");
  });

  it("joins arrays with '; ' -- the export file's declared list grammar", () => {
    expect(answerExportCell(["python", "rust", "go"])).toBe("python; rust; go");
  });

  it("renders booleans as 'true'/'false', not 'Yes'/'No'", () => {
    expect(answerExportCell(true)).toBe("true");
    expect(answerExportCell(false)).toBe("false");
  });

  it("renders null/undefined as ''", () => {
    expect(answerExportCell(null)).toBe("");
    expect(answerExportCell(undefined)).toBe("");
  });

  it("JSON.stringifies a plain object -- never '[object Object]'", () => {
    expect(answerExportCell({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
    expect(answerExportCell({ a: 1 })).not.toBe("[object Object]");
  });
});

describe("the four surfaces' divergences this closes", () => {
  it("multi-select separator: ', ' on screen vs '; ' in the export", () => {
    const value = ["A", "B"];
    expect(answerDisplayText(value)).toBe("A, B");
    expect(answerExportCell(value)).toBe("A; B");
  });

  it("boolean vocabulary: 'Yes' on screen vs 'true' in the export", () => {
    expect(answerDisplayText(true)).toBe("Yes");
    expect(answerExportCell(true)).toBe("true");
  });

  it("empty token: caller-declared on screen (default '') vs always '' in the export", () => {
    expect(answerDisplayText(null)).toBe("");
    expect(answerDisplayText(null, { empty: "—" })).toBe("—");
    expect(answerExportCell(null)).toBe("");
  });

  it("object rendering: both surfaces render JSON, neither prints '[object Object]'", () => {
    const value = { nested: true };
    expect(answerDisplayText(value)).toBe(JSON.stringify(value));
    expect(answerExportCell(value)).toBe(JSON.stringify(value));
  });
});
