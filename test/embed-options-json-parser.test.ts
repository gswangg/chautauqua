// DEC-839 amendment (wave 12): parseStoredEmbedOptions used to silently
// return {} for any non-object stored value and cast the rest through
// unvalidated. These tests pin the refusal behavior the ownership ledger
// (test/json-column-parser-ownership.scan.test.ts) now cites as proof
// embed.options_json has a real, validating owner.
import { describe, expect, it } from "vitest";
import { EmbedOptionsJsonError, parseStoredEmbedOptions } from "../src/server/repo/embeds";

describe("parseStoredEmbedOptions", () => {
  it("parses an empty object", () => {
    expect(parseStoredEmbedOptions("{}")).toEqual({});
  });

  it("parses a fully populated valid options object", () => {
    const stored = {
      trackId: "trk_1",
      sessionFormat: "Talk",
      roomId: "room_1",
      day: "2026-08-16",
      q: "keynote",
      limit: 10,
      fields: ["track", "room"],
      accent: "#336699",
    };
    expect(parseStoredEmbedOptions(JSON.stringify(stored))).toEqual(stored);
  });

  it("throws a named EmbedOptionsJsonError on invalid JSON", () => {
    expect(() => parseStoredEmbedOptions("{not json")).toThrow(EmbedOptionsJsonError);
    expect(() => parseStoredEmbedOptions("{not json")).toThrow(/options_json/);
  });

  it("throws instead of silently returning {} for a non-object stored value (array)", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify(["x"]))).toThrow(EmbedOptionsJsonError);
  });

  it("throws instead of silently returning {} for a non-object stored value (primitive)", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify("just a string"))).toThrow(EmbedOptionsJsonError);
    expect(() => parseStoredEmbedOptions(JSON.stringify(42))).toThrow(EmbedOptionsJsonError);
    expect(() => parseStoredEmbedOptions(JSON.stringify(null))).toThrow(EmbedOptionsJsonError);
  });

  it("throws on a non-string trackId", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify({ trackId: 5 }))).toThrow(/trackId/);
  });

  it("throws on a malformed day", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify({ day: "not-a-date" }))).toThrow(/day/);
    expect(() => parseStoredEmbedOptions(JSON.stringify({ day: "2026-13-40" }))).toThrow(/day/);
  });

  it("throws on an out-of-range limit", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify({ limit: 0 }))).toThrow(/limit/);
    expect(() => parseStoredEmbedOptions(JSON.stringify({ limit: 1000 }))).toThrow(/limit/);
    expect(() => parseStoredEmbedOptions(JSON.stringify({ limit: "5" }))).toThrow(/limit/);
  });

  it("throws on a fields array containing an unknown field name", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify({ fields: ["track", "bogus"] }))).toThrow(/fields/);
  });

  it("throws on a malformed accent value", () => {
    expect(() => parseStoredEmbedOptions(JSON.stringify({ accent: "not-a-color" }))).toThrow(/accent/);
  });

  it("normalizes a shorthand accent hex the same way the write door would", () => {
    expect(parseStoredEmbedOptions(JSON.stringify({ accent: "#abc" }))).toEqual({ accent: "#aabbcc" });
  });
});
