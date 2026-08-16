// DEC-839 amendment (wave 12): parseEventBranding used to throw a bare
// TypeError on a stored literal `null` (property access on null) and pass
// a non-string accentColor straight through unvalidated. These tests pin
// the refusal behavior the ownership ledger
// (test/json-column-parser-ownership.scan.test.ts) now cites as proof
// event.branding_json has a real, validating owner.
import { describe, expect, it } from "vitest";
import { EventBrandingJsonError, parseEventBranding } from "../src/domain/event-branding";

describe("parseEventBranding", () => {
  it("returns an empty object for null/undefined/empty stored value", () => {
    expect(parseEventBranding(null)).toEqual({});
    expect(parseEventBranding(undefined)).toEqual({});
    expect(parseEventBranding("")).toEqual({});
  });

  it("parses a valid branding object", () => {
    expect(parseEventBranding(JSON.stringify({ logoUrl: "https://example.com/logo.png", accentColor: "#336699" }))).toEqual({
      logoUrl: "https://example.com/logo.png",
      accentColor: "#336699",
    });
  });

  it("throws a named EventBrandingJsonError, not a bare TypeError, on a stored JSON literal null", () => {
    expect(() => parseEventBranding("null")).toThrow(EventBrandingJsonError);
    expect(() => parseEventBranding("null")).toThrow(/branding_json/);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseEventBranding("{not json")).toThrow(EventBrandingJsonError);
  });

  it("throws on a non-object stored value (array/primitive)", () => {
    expect(() => parseEventBranding(JSON.stringify(["x"]))).toThrow(EventBrandingJsonError);
    expect(() => parseEventBranding(JSON.stringify("just a string"))).toThrow(EventBrandingJsonError);
    expect(() => parseEventBranding(JSON.stringify(42))).toThrow(EventBrandingJsonError);
  });

  it("throws instead of passing a non-string accentColor straight through", () => {
    expect(() => parseEventBranding(JSON.stringify({ accentColor: 12345 }))).toThrow(/accentColor/);
  });

  it("throws on a non-string logoUrl", () => {
    expect(() => parseEventBranding(JSON.stringify({ logoUrl: 12345 }))).toThrow(/logoUrl/);
  });

  it("drops (does not throw on) a logoUrl safeImageSrc rejects, per DEC-322", () => {
    expect(parseEventBranding(JSON.stringify({ logoUrl: "javascript:alert(1)" }))).toEqual({});
  });

  it("passes a syntactically-string but grammar-invalid accentColor straight through (hex-grammar validation stays at the render edge, DEC-374)", () => {
    expect(parseEventBranding(JSON.stringify({ accentColor: "not-a-hex-color" }))).toEqual({
      accentColor: "not-a-hex-color",
    });
  });
});
