// DEC-015 (wave-80 amendment): form.tracks_json now has ONE declared parser,
// parseFormTracks (src/forms/form-tracks.ts). Before this module, the admin
// wire (toFormRow in src/server/repo/forms.ts) hand-parsed the column with a
// bare `JSON.parse(...) as string[]` while the public/portal path went
// through resolveOfferedTrackIds (src/lib/submit-core.ts), which validated
// array-ness and treated an empty array as "all event tracks are offered"
// per DEC-015. This file proves (a) the parser's own contract, (b) that no
// other non-test file under src/ still hand-parses tracksJson, and (c) that
// the admin projection and resolveOfferedTrackIds agree on the SAME stored
// value, including the empty-array case.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { FormTracksError, parseFormTracks } from "../src/forms/form-tracks";
import { resolveOfferedTrackIds } from "../src/lib/submit-core";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const OWNER_ABS = join(SRC_ROOT, "forms", "form-tracks.ts");

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

// A hand-parse of the tracksJson column: JSON.parse applied directly to
// something spelled `tracksJson`, rather than going through parseFormTracks.
// Matches both `JSON.parse(x.tracksJson)` and the ternary-guarded shape
// across a line break, so a reformatted copy still trips it.
function handParsesTracksJson(source: string): boolean {
  return /JSON\.parse\([^)]*tracksJson[^)]*\)/.test(source);
}

describe("form.tracks_json single parser (DEC-015, wave 80)", () => {
  it("null/undefined/empty string all parse to null (no restriction)", () => {
    expect(parseFormTracks(null, "form-1")).toBeNull();
    expect(parseFormTracks(undefined, "form-1")).toBeNull();
    expect(parseFormTracks("", "form-1")).toBeNull();
  });

  it("an empty array also parses to null -- the ONE spelling of 'all event tracks'", () => {
    expect(parseFormTracks("[]", "form-1")).toBeNull();
  });

  it("a populated array of track ids parses to that array", () => {
    expect(parseFormTracks(JSON.stringify(["t1", "t2"]), "form-1")).toEqual(["t1", "t2"]);
  });

  it("malformed JSON throws FormTracksError rather than silently falling back", () => {
    expect(() => parseFormTracks("{not json", "form-1")).toThrow(FormTracksError);
  });

  it("a non-array throws", () => {
    expect(() => parseFormTracks(JSON.stringify({ a: 1 }), "form-1")).toThrow(FormTracksError);
    expect(() => parseFormTracks('"just a string"', "form-1")).toThrow(FormTracksError);
    expect(() => parseFormTracks("42", "form-1")).toThrow(FormTracksError);
  });

  it("an array with a non-string (numeric) member throws rather than silently dropping it", () => {
    expect(() => parseFormTracks(JSON.stringify(["t1", 2]), "form-1")).toThrow(FormTracksError);
  });

  it("the error message names the offending form id", () => {
    expect(() => parseFormTracks("{not json", "form-xyz")).toThrow(/form-xyz/);
  });

  it("positive control: the detector fires on a hand-parse shape", () => {
    expect(handParsesTracksJson("const x = row.tracksJson ? JSON.parse(row.tracksJson) : null;")).toBe(true);
    expect(handParsesTracksJson("JSON.parse(target.tracksJson)")).toBe(true);
  });

  it("no non-test file under src/ other than the declaring module hand-parses tracksJson", () => {
    const files = walk(SRC_ROOT).filter((f) => f !== OWNER_ABS);
    const offenders = files
      .filter((f) => handParsesTracksJson(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).split(sep).join("/"));
    expect(offenders).toEqual([]);
  });

  it("sanity: the owner path referenced above matches the real relative path", () => {
    expect(relative(ROOT, OWNER_ABS).split(sep).join("/")).toBe("src/forms/form-tracks.ts");
  });

  describe("admin projection and resolveOfferedTrackIds agree on the same stored value", () => {
    const eventTrackIds = ["t1", "t2", "t3"];

    function adminTracks(tracksJson: string | null): string[] | null {
      // Mirrors toFormRow (src/server/repo/forms.ts) exactly.
      return parseFormTracks(tracksJson, "form-1");
    }

    it("a stored empty array means 'all event tracks' on BOTH sides", () => {
      const stored = "[]";
      expect(adminTracks(stored)).toBeNull();
      expect(resolveOfferedTrackIds(stored, eventTrackIds, "form-1")).toEqual(eventTrackIds);
    });

    it("a stored null means 'all event tracks' on BOTH sides", () => {
      expect(adminTracks(null)).toBeNull();
      expect(resolveOfferedTrackIds(null, eventTrackIds, "form-1")).toEqual(eventTrackIds);
    });

    it("a stored non-empty subset agrees on both sides", () => {
      const stored = JSON.stringify(["t1", "t3"]);
      expect(adminTracks(stored)).toEqual(["t1", "t3"]);
      expect(resolveOfferedTrackIds(stored, eventTrackIds, "form-1")).toEqual(["t1", "t3"]);
    });
  });
});
