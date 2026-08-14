// DEC-433 amendment (wave 45): versionedCacheKey (src/server/pubcache.ts)
// now skips a keyed param whose value is over MAX_PUBLIC_QUERY_VALUE_LENGTH
// (treating it exactly as absent) instead of relying on the deleted
// hasOverlongQueryValue whole-request bypass. That's only sound if every
// route-layer parser for a PUBLIC_CACHE_KEY_PARAMS name ALSO treats an
// over-cap value the same as it treats `undefined` — otherwise the cached
// page (keyed as if the param were absent) could disagree with what the
// handler actually renders (keyed-as-absent-but-parsed-as-present is the
// dangerous direction; this test proves it can't happen for any of the ten
// keyed params). This is a PROOF, not a spot check: it iterates every name
// in PUBLIC_CACHE_KEY_PARAMS and calls the exact parser the routes use.

import { describe, expect, it } from "vitest";
import { PUBLIC_CACHE_KEY_PARAMS, MAX_PUBLIC_QUERY_VALUE_LENGTH } from "../src/server/repo/public/bounds";
import {
  parseTrackId,
  parsePage,
  parseNameQuery,
  parseDay,
  parseLimit,
  parseCardFields,
  parseSessionListFields,
  parseFormat,
  parseRoomId,
  parseAccent,
} from "../src/routes/public/query";
import { isValidFrom, type Surface } from "../src/routes/public/shell";

const OVER = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH + 1);

// One parser call per keyed name, run against both an over-cap value and
// `undefined`, asserted equal. `fields` gets its own two entries because
// two distinct route-layer parsers read it (list default vs. all-on).
const PARSERS: Record<string, (raw: string | undefined) => unknown> = {
  trackId: parseTrackId,
  page: parsePage,
  q: parseNameQuery,
  day: parseDay,
  limit: parseLimit,
  fields: parseCardFields,
  format: parseFormat,
  roomId: parseRoomId,
  from: (raw) => isValidFrom(raw, "sessions" as Surface),
  accent: parseAccent,
};

describe("every PUBLIC_CACHE_KEY_PARAMS parser treats an over-cap value exactly like absence", () => {
  it("PUBLIC_CACHE_KEY_PARAMS and PARSERS name the exact same set (proof is exhaustive, not partial)", () => {
    expect(new Set(Object.keys(PARSERS))).toEqual(new Set(PUBLIC_CACHE_KEY_PARAMS));
  });

  for (const name of PUBLIC_CACHE_KEY_PARAMS) {
    it(`${name}: parses an over-cap (${MAX_PUBLIC_QUERY_VALUE_LENGTH + 1}-char) value the same as undefined`, () => {
      const parser = PARSERS[name]!;
      expect(parser(OVER)).toEqual(parser(undefined));
    });
  }

  it("fields: parseSessionListFields ALSO treats an over-cap value the same as undefined (second reader of `fields`)", () => {
    expect(parseSessionListFields(OVER)).toEqual(parseSessionListFields(undefined));
  });

  it("sanity: an IN-cap value is not swallowed the same way (the proof above isn't vacuous)", () => {
    expect(parseTrackId("abc")).not.toEqual(parseTrackId(undefined));
    expect(parseNameQuery("keynote")).not.toEqual(parseNameQuery(undefined));
  });
});
