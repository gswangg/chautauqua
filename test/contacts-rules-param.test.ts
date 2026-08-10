// DEC-149: GET /contacts?rules=<URL-encoded JSON SegmentRule[]> parsing +
// validation (parseRulesQueryParam), unit-tested directly rather than
// through the full route (no D1 test harness exists — see the comment atop
// src/server/repo/contacts.ts).

import { describe, expect, it } from "vitest";
import { parseRulesQueryParam } from "../src/routes/api/contacts";
import { ApiError } from "../src/server/http";

describe("parseRulesQueryParam (DEC-149)", () => {
  it("returns [] for undefined or blank input", () => {
    expect(parseRulesQueryParam(undefined)).toEqual([]);
    expect(parseRulesQueryParam("")).toEqual([]);
    expect(parseRulesQueryParam("   ")).toEqual([]);
  });

  it("parses a valid URL-encoded JSON rules array, including field 'any'", () => {
    const raw = JSON.stringify([
      { field: "any", op: "contains", value: "ada" },
      { field: "company", op: "eq", value: "Acme" },
    ]);
    expect(parseRulesQueryParam(raw)).toEqual([
      { field: "any", op: "contains", value: "ada" },
      { field: "company", op: "eq", value: "Acme" },
    ]);
  });

  it("400s with {error:{code,message,fields}} on invalid JSON", () => {
    try {
      parseRulesQueryParam("{not json");
      throw new Error("expected parseRulesQueryParam to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("invalid");
      expect(apiErr.fields).toEqual({ rules: "invalid JSON" });
    }
  });

  it("400s when rules is not an array", () => {
    expect(() => parseRulesQueryParam(JSON.stringify({ field: "any", op: "eq", value: "x" }))).toThrow(ApiError);
  });

  it("400s on a malformed rule shape", () => {
    expect(() => parseRulesQueryParam(JSON.stringify([{ field: "any", op: "bogus", value: "x" }]))).toThrow(ApiError);
    expect(() => parseRulesQueryParam(JSON.stringify([{ field: "any", value: "x" }]))).toThrow(ApiError);
  });

  it("400s on an unknown field name (fail loudly, not silently ignored)", () => {
    try {
      parseRulesQueryParam(JSON.stringify([{ field: "nickname", op: "eq", value: "x" }]));
      throw new Error("expected parseRulesQueryParam to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("invalid");
    }
  });
});
