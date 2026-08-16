import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  PlanJsonError,
  parsePlanScale,
  parsePlanCriteria,
  parsePlanFilters,
  parseRoundCriteria,
  parseRoundMeta,
} from "../src/domain/evaluation/plan-json";

describe("parsePlanScale", () => {
  it("parses a valid scale", () => {
    expect(parsePlanScale(JSON.stringify({ min: 1, max: 5 }), "p1")).toEqual({ min: 1, max: 5 });
  });

  it("throws a named PlanJsonError on invalid JSON", () => {
    expect(() => parsePlanScale("{not json", "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanScale("{not json", "p1")).toThrow(/p1/);
    expect(() => parsePlanScale("{not json", "p1")).toThrow(/scale_json/);
  });

  it("throws on a non-object", () => {
    expect(() => parsePlanScale(JSON.stringify([1, 5]), "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanScale(JSON.stringify("x"), "p1")).toThrow(PlanJsonError);
  });

  it("throws when min or max is missing or non-numeric", () => {
    expect(() => parsePlanScale(JSON.stringify({ max: 5 }), "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanScale(JSON.stringify({ min: "1", max: 5 }), "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanScale(JSON.stringify({ min: 1, max: "5" }), "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanScale(JSON.stringify({ min: NaN, max: 5 }), "p1")).toThrow(PlanJsonError);
  });

  it("throws when min is not less than max", () => {
    expect(() => parsePlanScale(JSON.stringify({ min: 5, max: 5 }), "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanScale(JSON.stringify({ min: 6, max: 5 }), "p1")).toThrow(PlanJsonError);
  });
});

describe("parsePlanCriteria", () => {
  it("parses a valid criteria array (rating, dropdown, text)", () => {
    const criteria = [
      { id: "relevance", label: "Relevance", kind: "rating", weight: 1 },
      { id: "format", label: "Format", kind: "dropdown", options: ["Talk"] },
      { id: "notes", label: "Notes", kind: "text" },
    ];
    expect(parsePlanCriteria(JSON.stringify(criteria), "p1")).toEqual(criteria);
  });

  it("parses an empty array", () => {
    expect(parsePlanCriteria(JSON.stringify([]), "p1")).toEqual([]);
  });

  it("throws a named PlanJsonError on invalid JSON", () => {
    expect(() => parsePlanCriteria("{not json", "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanCriteria("{not json", "p1")).toThrow(/p1/);
    expect(() => parsePlanCriteria("{not json", "p1")).toThrow(/criteria_json/);
  });

  it("throws on a non-array value", () => {
    expect(() => parsePlanCriteria(JSON.stringify({ a: 1 }), "p1")).toThrow(PlanJsonError);
  });

  it("throws when an entry is not an object", () => {
    expect(() => parsePlanCriteria(JSON.stringify(["x"]), "p1")).toThrow(PlanJsonError);
  });

  it("throws when id is missing or empty", () => {
    expect(() =>
      parsePlanCriteria(JSON.stringify([{ label: "L", kind: "rating", weight: 1 }]), "p1"),
    ).toThrow(PlanJsonError);
    expect(() =>
      parsePlanCriteria(JSON.stringify([{ id: "", label: "L", kind: "rating", weight: 1 }]), "p1"),
    ).toThrow(PlanJsonError);
  });

  it("throws when label is missing or non-string", () => {
    expect(() =>
      parsePlanCriteria(JSON.stringify([{ id: "a", kind: "rating", weight: 1 }]), "p1"),
    ).toThrow(PlanJsonError);
  });

  it("throws when weight is present but non-numeric or negative -- the NaN-on-results defect", () => {
    expect(() =>
      parsePlanCriteria(JSON.stringify([{ id: "a", label: "A", kind: "rating", weight: "1" }]), "p1"),
    ).toThrow(PlanJsonError);
    expect(() =>
      parsePlanCriteria(JSON.stringify([{ id: "a", label: "A", kind: "rating", weight: -1 }]), "p1"),
    ).toThrow(PlanJsonError);
    expect(() =>
      parsePlanCriteria(JSON.stringify([{ id: "a", label: "A", kind: "rating" }]), "p1"),
    ).not.toThrow();
  });
});

describe("parsePlanFilters", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(parsePlanFilters(null, "p1")).toBeNull();
    expect(parsePlanFilters(undefined, "p1")).toBeNull();
    expect(parsePlanFilters("", "p1")).toBeNull();
  });

  it("parses a valid trackIds filter", () => {
    expect(parsePlanFilters(JSON.stringify({ trackIds: ["t1", "t2"] }), "p1")).toEqual({
      trackIds: ["t1", "t2"],
    });
  });

  it("parses an object with no trackIds as {}", () => {
    expect(parsePlanFilters(JSON.stringify({}), "p1")).toEqual({});
  });

  it("throws a named PlanJsonError on invalid JSON", () => {
    expect(() => parsePlanFilters("{not json", "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanFilters("{not json", "p1")).toThrow(/filters_json/);
  });

  it("throws on a non-object", () => {
    expect(() => parsePlanFilters(JSON.stringify(["a"]), "p1")).toThrow(PlanJsonError);
  });

  it("throws when trackIds is not an array of strings", () => {
    expect(() => parsePlanFilters(JSON.stringify({ trackIds: "t1" }), "p1")).toThrow(PlanJsonError);
    expect(() => parsePlanFilters(JSON.stringify({ trackIds: [1, 2] }), "p1")).toThrow(PlanJsonError);
  });
});

describe("parseRoundCriteria", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(parseRoundCriteria(null, "p1")).toBeNull();
    expect(parseRoundCriteria(undefined, "p1")).toBeNull();
    expect(parseRoundCriteria("", "p1")).toBeNull();
  });

  it("parses a valid round -> criteria map", () => {
    const map = { "2": [{ id: "a", label: "A", kind: "rating", weight: 1 }] };
    expect(parseRoundCriteria(JSON.stringify(map), "p1")).toEqual(map);
  });

  it("throws a named PlanJsonError on invalid JSON", () => {
    expect(() => parseRoundCriteria("{not json", "p1")).toThrow(PlanJsonError);
    expect(() => parseRoundCriteria("{not json", "p1")).toThrow(/round_criteria_json/);
  });

  it("throws on a non-object container", () => {
    expect(() => parseRoundCriteria(JSON.stringify(["a"]), "p1")).toThrow(PlanJsonError);
  });

  it("throws when a round's value is not an array", () => {
    expect(() => parseRoundCriteria(JSON.stringify({ "2": { id: "a" } }), "p1")).toThrow(PlanJsonError);
  });

  it("throws when a round's criterion entry is malformed", () => {
    expect(() =>
      parseRoundCriteria(JSON.stringify({ "2": [{ id: "a", label: "A", kind: "rating", weight: "bad" }] }), "p1"),
    ).toThrow(PlanJsonError);
  });
});

describe("parseRoundMeta", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(parseRoundMeta(null, "p1")).toBeNull();
    expect(parseRoundMeta(undefined, "p1")).toBeNull();
    expect(parseRoundMeta("", "p1")).toBeNull();
  });

  it("parses a valid round meta map", () => {
    const map = { "2": { name: "Final Review", opensAt: 100, closesAt: 200 } };
    expect(parseRoundMeta(JSON.stringify(map), "p1")).toEqual(map);
  });

  it("throws a named PlanJsonError on invalid JSON", () => {
    expect(() => parseRoundMeta("{not json", "p1")).toThrow(PlanJsonError);
    expect(() => parseRoundMeta("{not json", "p1")).toThrow(/round_meta_json/);
  });

  it("throws on a non-object container", () => {
    expect(() => parseRoundMeta(JSON.stringify(["a"]), "p1")).toThrow(PlanJsonError);
  });

  it("throws on a malformed entry (reusing roundMetaFor's own validation)", () => {
    expect(() => parseRoundMeta(JSON.stringify({ "2": { name: 5 } }), "p1")).toThrow(PlanJsonError);
    expect(() => parseRoundMeta(JSON.stringify({ "2": { opensAt: "soon" } }), "p1")).toThrow(PlanJsonError);
    expect(() => parseRoundMeta(JSON.stringify({ "2": "final" }), "p1")).toThrow(PlanJsonError);
  });
});

// --- Source scan: no reader outside this module bare-parses these five
// columns. exports/evaluations.ts is explicitly out of scope (DEC-147 wave
// 80 amendment): its labelByCriterionId is a deliberately tolerant LABEL
// reader, never a WEIGHT source. ---

const ROOT = join(__dirname, "..");
const SCAN_DIRS = [
  join(ROOT, "src", "server", "repo", "review"),
  join(ROOT, "src", "domain", "evaluation"),
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);
const COLUMN_NAMES = ["criteriaJson", "scaleJson", "filtersJson", "roundCriteriaJson", "roundMetaJson"];
const BARE_PARSE_RE = new RegExp(`JSON\\.parse\\s*\\([^)]*\\b(${COLUMN_NAMES.join("|")})\\b`, "g");

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (stat.isFile() && /\.ts$/.test(entry)) out.push(full);
  }
}

function readScanFiles(): { path: string; text: string }[] {
  const abs: string[] = [];
  for (const dir of SCAN_DIRS) walk(dir, abs);
  return abs.map((full) => ({ path: relative(ROOT, full).split("\\").join("/"), text: readFileSync(full, "utf8") }));
}

describe("plan-json single parser scan (DEC-147 amendment, wave 80)", () => {
  it("scans a non-trivial number of files", () => {
    expect(readScanFiles().length).toBeGreaterThanOrEqual(10);
  });

  it("no file under src/server/repo/review or src/domain/evaluation bare-parses a plan JSON column, except plan-json.ts itself", () => {
    const problems: string[] = [];
    for (const file of readScanFiles()) {
      if (file.path.endsWith("src/domain/evaluation/plan-json.ts")) continue;
      // exports/evaluations.ts is not under either scanned directory, so it
      // is structurally excluded already -- see DEC-147 wave-80 amendment.
      BARE_PARSE_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BARE_PARSE_RE.exec(file.text))) {
        const line = file.text.slice(0, m.index).split("\n").length;
        problems.push(`${file.path}:${line} bare JSON.parse(...${m[1]}...) -- route through src/domain/evaluation/plan-json.ts instead`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("negative control: the scan's regex does flag a synthetic bare parse", () => {
    BARE_PARSE_RE.lastIndex = 0;
    expect(BARE_PARSE_RE.test("const x = JSON.parse(row.criteriaJson);")).toBe(true);
  });
});
