// DEC-592 (Amendment, wave 80): src/server/repo/form-roles.ts is the ONE
// module that resolves a role-tagged submission_answer's stored value.json
// into a label -- `roleAnswerLabel` for a single row, `roleAnswerMap` for a
// batch of rows keyed by submissionId. This scan proves (a) the owner
// exists and exports both names, (b) a positive control fires the detector
// on the owner itself, (c) no other file under src/ contains a second copy
// of the "JSON.parse -> typeof string && length>0 ? : null" ladder over a
// valueJson, (d) roleAnswerLabel's branches behave as documented, and (e) a
// behavioural pin: an event carrying one empty-string format answer must
// have the hub's format count and the per-session `format` field agree
// (the DEC-592 wave-80 defect: public/home.ts's SQL COUNT DISTINCT used to
// count stored "" as a format).
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { roleAnswerLabel, roleAnswerMap } from "../src/server/repo/form-roles";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const OWNER_ABS = join(SRC_ROOT, "server", "repo", "form-roles.ts");
const OWNER_REL = "src/server/repo/form-roles.ts";

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

// The exact shape of the retired ladder: JSON.parse a valueJson-ish
// identifier, then a typeof-string-and-nonempty-length ternary to null.
// Matched loosely enough (parse + ternary anywhere in the same file text)
// that a reformatted copy still trips it, but anchored on "valueJson" so it
// never collides with answer-text.ts's unrelated grammar.
function declaresRoleAnswerLadder(source: string): boolean {
  const hasValueJsonParse = /JSON\.parse\([^)]*[Vv]alueJson[^)]*\)/.test(source);
  const hasStringLengthTernary = /typeof\s+\w+\s*===\s*["']string["']\s*&&\s*\w+\.length\s*>\s*0\s*\?\s*\w+\s*:\s*null/.test(
    source,
  );
  return hasValueJsonParse && hasStringLengthTernary;
}

describe("role-answer single source (DEC-592, wave 80)", () => {
  it("the owner module exists and exports both roleAnswerLabel and roleAnswerMap", () => {
    const source = readFileSync(OWNER_ABS, "utf8");
    expect(source).toMatch(/export function roleAnswerLabel\(/);
    expect(source).toMatch(/export function roleAnswerMap\(/);
  });

  it("positive control: the detector fires on the owner file itself (its roleAnswerLabel body IS the retired ladder, just factored into one function)", () => {
    const source = readFileSync(OWNER_ABS, "utf8");
    expect(declaresRoleAnswerLadder(source)).toBe(true);
  });

  it("no OTHER file under src/ contains a second copy of the retired ladder", () => {
    const files = walk(SRC_ROOT).filter((f) => f !== OWNER_ABS);
    const offenders = files
      .filter((f) => declaresRoleAnswerLadder(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("sanity: the owner path referenced above matches the real relative path", () => {
    expect(relative(ROOT, OWNER_ABS).split(require("node:path").sep).join("/")).toBe(OWNER_REL);
  });

  describe("roleAnswerLabel branches", () => {
    it("a non-empty JSON string is the label", () => {
      expect(roleAnswerLabel('"Keynote"')).toBe("Keynote");
    });

    it("a stored empty string is null", () => {
      expect(roleAnswerLabel('""')).toBeNull();
    });

    it("JSON null is null", () => {
      expect(roleAnswerLabel("null")).toBeNull();
    });

    it("a number is null", () => {
      expect(roleAnswerLabel("5")).toBeNull();
    });

    it("an array is null", () => {
      expect(roleAnswerLabel('["Keynote"]')).toBeNull();
    });

    it("an object is null", () => {
      expect(roleAnswerLabel('{"label":"Keynote"}')).toBeNull();
    });
  });

  describe("roleAnswerMap", () => {
    it("collects each row's roleAnswerLabel keyed by submissionId", () => {
      const map = roleAnswerMap([
        { submissionId: "s1", valueJson: '"Keynote"' },
        { submissionId: "s2", valueJson: '""' },
        { submissionId: "s3", valueJson: "null" },
      ]);
      expect(map.get("s1")).toBe("Keynote");
      expect(map.get("s2")).toBeNull();
      expect(map.get("s3")).toBeNull();
      expect(map.size).toBe(3);
    });

    it("an empty row set yields an empty map", () => {
      expect(roleAnswerMap([]).size).toBe(0);
    });
  });

  // DEC-592 (Amendment, wave 80): public/home.ts's format-count aggregate
  // runs in SQL (no local sqlite/D1 driver is wired up for this repo -- see
  // test/home-repo.test.ts's fake-chain harness, which never evaluates a
  // real WHERE), so this pin mirrors the SQL predicate
  // (`valueJson LIKE '"%"' AND valueJson != '""'`) as plain JS and proves it
  // agrees with roleAnswerLabel row-for-row on an event carrying one
  // stored-empty-string format answer: the hub's distinct-label count must
  // exclude exactly the rows roleAnswerLabel maps to null, so "/"'s N
  // formats line can never exceed the number of formats any session on
  // that event actually shows (the wave-80 defect: the un-narrowed
  // `count(distinct valueJson)` counted "" as a format).
  describe("behavioural pin: hub format count agrees with the per-session format field", () => {
    function sqlFormatCountPredicate(valueJson: string): boolean {
      // Mirror of public/home.ts's added WHERE clause: valueJson LIKE
      // '"%"' AND valueJson != '""' -- "starts and ends with a quote, and
      // isn't exactly the empty-string literal".
      return valueJson.startsWith('"') && valueJson.endsWith('"') && valueJson !== '""';
    }

    it("a stored empty-string answer is excluded from the hub count AND resolves to a null per-session format", () => {
      const eventSubmissionAnswers = [
        { submissionId: "sub-1", valueJson: '"Keynote"' },
        { submissionId: "sub-2", valueJson: '""' }, // stored-empty answer -- the wave-80 defect case
        { submissionId: "sub-3", valueJson: '"Workshop"' },
      ];

      // The hub aggregate: distinct valueJson passing the SQL predicate.
      const hubFormatCount = new Set(
        eventSubmissionAnswers.filter((r) => sqlFormatCountPredicate(r.valueJson)).map((r) => r.valueJson),
      ).size;

      // The per-session reader: roleAnswerMap over the same rows.
      const perSessionFormat = roleAnswerMap(eventSubmissionAnswers);

      expect(hubFormatCount).toBe(2); // "Keynote", "Workshop" -- never the stored ""
      expect(perSessionFormat.get("sub-1")).toBe("Keynote");
      expect(perSessionFormat.get("sub-2")).toBeNull(); // agrees: sub-2 shows no format
      expect(perSessionFormat.get("sub-3")).toBe("Workshop");

      // The set the SQL predicate admits is exactly the set roleAnswerLabel
      // yields non-null for -- the DEC-592 contract this pin exists to
      // enforce.
      for (const r of eventSubmissionAnswers) {
        expect(sqlFormatCountPredicate(r.valueJson)).toBe(roleAnswerLabel(r.valueJson) !== null);
      }
    });
  });
});
