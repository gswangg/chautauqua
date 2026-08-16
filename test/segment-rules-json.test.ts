// DEC-026 (wave-81 amendment): the write path (POST/PATCH /segments)
// validates rules_json shape before it ever reaches the DB; the read side
// (segments.ts GET route, contacts/shared.ts serializeSegment, crud.ts
// scanAndFilterContacts) used to cast it raw. parseSegmentRulesJson spends
// the same shape check on read, so a malformed row fails loudly with a
// named error instead of an unnamed TypeError deep inside matchesRule.

import { describe, expect, it } from "vitest";
import { parseSegmentRulesJson, MAX_SEGMENT_RULES } from "../src/domain/contacts-parts/segments";

describe("parseSegmentRulesJson", () => {
  it("round-trips a valid rule set unchanged", () => {
    const rules = [
      { field: "email", op: "eq" as const, value: "a@b.com" },
      { field: "custom.plan", op: "contains" as const, value: "pro" },
    ];
    expect(parseSegmentRulesJson(JSON.stringify(rules), "seg-1")).toEqual(rules);
  });

  it("refuses a non-array rules_json", () => {
    expect(() => parseSegmentRulesJson(JSON.stringify({ field: "email" }), "seg-2")).toThrow(
      /seg-2\.rules_json.*expected an array/,
    );
  });

  it("refuses an entry with a non-string value (the bare TypeError case)", () => {
    const raw = JSON.stringify([{ field: "email", op: "eq", value: 5 }]);
    expect(() => parseSegmentRulesJson(raw, "seg-3")).toThrow(/seg-3\.rules_json/);
  });

  it("refuses an unknown op", () => {
    const raw = JSON.stringify([{ field: "email", op: "startswith", value: "a" }]);
    expect(() => parseSegmentRulesJson(raw, "seg-4")).toThrow(/seg-4\.rules_json/);
  });

  it("refuses a rule count above MAX_SEGMENT_RULES", () => {
    const rules = Array.from({ length: MAX_SEGMENT_RULES + 1 }, () => ({
      field: "email",
      op: "eq" as const,
      value: "x",
    }));
    expect(() => parseSegmentRulesJson(JSON.stringify(rules), "seg-5")).toThrow(
      /seg-5\.rules_json.*MAX_SEGMENT_RULES/,
    );
  });

  it("accepts exactly MAX_SEGMENT_RULES rules", () => {
    const rules = Array.from({ length: MAX_SEGMENT_RULES }, () => ({
      field: "email",
      op: "eq" as const,
      value: "x",
    }));
    expect(parseSegmentRulesJson(JSON.stringify(rules), "seg-6")).toHaveLength(MAX_SEGMENT_RULES);
  });
});
