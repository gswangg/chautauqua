// DEC-772: parseFormatDurationMin extracts a session's own scheduled length
// from its format option label, so auto-schedule stops flattening every
// session to the grid's default duration.

import { describe, expect, it } from "vitest";
import { parseFormatDurationMin } from "../src/domain/schedule";

describe("parseFormatDurationMin (DEC-772)", () => {
  it("parses '(N min)' suffix", () => {
    expect(parseFormatDurationMin("Keynote (45 min)")).toBe(45);
  });

  it("parses '(N mins)' suffix", () => {
    expect(parseFormatDurationMin("Lightning Talk (10 mins)")).toBe(10);
  });

  it("parses '(N minutes)' suffix", () => {
    expect(parseFormatDurationMin("Workshop (120 minutes)")).toBe(120);
  });

  it("is case-insensitive", () => {
    expect(parseFormatDurationMin("Panel (60 MIN)")).toBe(60);
  });

  it("returns null when the label has no parenthesised duration", () => {
    expect(parseFormatDurationMin("Keynote")).toBeNull();
  });

  it("returns null when the label is null/undefined/empty", () => {
    expect(parseFormatDurationMin(null)).toBeNull();
    expect(parseFormatDurationMin(undefined)).toBeNull();
    expect(parseFormatDurationMin("")).toBeNull();
  });

  it("returns null for a non-positive duration", () => {
    expect(parseFormatDurationMin("Broken (0 min)")).toBeNull();
  });

  it("returns null when the parens contain unrelated text", () => {
    expect(parseFormatDurationMin("Keynote (main stage)")).toBeNull();
  });
});
