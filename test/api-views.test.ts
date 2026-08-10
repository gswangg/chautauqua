/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { isValidSavedViewConfig } from "../src/server/repo/views";

describe("isValidSavedViewConfig (DEC-031 config_json shape validation)", () => {
  it("accepts a well-formed config", () => {
    expect(
      isValidSavedViewConfig({
        q: "keynote",
        status: ["pending", "accepted"],
        trackId: "trk1",
        sort: "title",
        columns: ["field1", "field2"],
      }),
    ).toBe(true);
  });

  it("accepts null trackId and empty arrays/strings", () => {
    expect(
      isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "newest", columns: [] }),
    ).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isValidSavedViewConfig(null)).toBe(false);
    expect(isValidSavedViewConfig(undefined)).toBe(false);
    expect(isValidSavedViewConfig("nope")).toBe(false);
    expect(isValidSavedViewConfig(42)).toBe(false);
    expect(isValidSavedViewConfig([])).toBe(false);
  });

  it("rejects a missing/non-string q", () => {
    expect(isValidSavedViewConfig({ status: [], trackId: null, sort: "newest", columns: [] })).toBe(false);
    expect(isValidSavedViewConfig({ q: 1, status: [], trackId: null, sort: "newest", columns: [] })).toBe(false);
  });

  it("rejects an unknown status literal", () => {
    expect(
      isValidSavedViewConfig({ q: "", status: ["bogus"], trackId: null, sort: "newest", columns: [] }),
    ).toBe(false);
  });

  it("rejects a non-string, non-null trackId", () => {
    expect(isValidSavedViewConfig({ q: "", status: [], trackId: 5, sort: "newest", columns: [] })).toBe(false);
  });

  it("rejects an invalid sort literal", () => {
    expect(
      isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "bogus", columns: [] }),
    ).toBe(false);
  });

  it("rejects a non-array columns or non-string entries", () => {
    expect(isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "newest", columns: "nope" })).toBe(
      false,
    );
    expect(isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "newest", columns: [1, 2] })).toBe(
      false,
    );
  });
});
