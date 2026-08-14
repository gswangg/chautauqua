// DEC-433 amendment (wave 30): the public query grammar's STRING params
// (trackId/format/roomId/q) get the same "over-cap parses to null, never
// throws" contract parseLimit/parseDay/parseAccent already keep — bounded
// by MAX_PUBLIC_QUERY_VALUE_LENGTH, the ONE home for the number
// (src/server/repo/public/bounds.ts).

import { describe, expect, it } from "vitest";
import { parseFormat, parseNameQuery, parseRoomId, parseTrackId } from "../src/routes/public/query";
import { MAX_PUBLIC_QUERY_VALUE_LENGTH } from "../src/server/repo/public/bounds";

const parsers: Array<[string, (raw: string | undefined) => string | null]> = [
  ["parseTrackId", parseTrackId],
  ["parseFormat", parseFormat],
  ["parseRoomId", parseRoomId],
  ["parseNameQuery", parseNameQuery],
];

describe.each(parsers)("%s bounds (DEC-433 amendment, wave 30)", (_name, parse) => {
  it("returns null for undefined", () => {
    expect(parse(undefined)).toBeNull();
  });

  it("returns null for an all-whitespace value", () => {
    expect(parse("   ")).toBeNull();
  });

  it("trims and returns an in-cap value untouched (modulo trim)", () => {
    expect(parse("  keynote  ")).toBe("keynote");
  });

  it("returns the value untouched at exactly the cap", () => {
    const atCap = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH);
    expect(parse(atCap)).toBe(atCap);
  });

  it("degrades to null (never throws) one byte over the cap", () => {
    const overCap = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH + 1);
    expect(() => parse(overCap)).not.toThrow();
    expect(parse(overCap)).toBeNull();
  });

  it("degrades to null for a wildly over-cap value", () => {
    const megabyte = "a".repeat(1_000_000);
    expect(() => parse(megabyte)).not.toThrow();
    expect(parse(megabyte)).toBeNull();
  });
});
