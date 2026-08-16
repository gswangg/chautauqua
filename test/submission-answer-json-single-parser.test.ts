import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SubmissionAnswerJsonError, parseSubmissionAnswerValue } from "../src/forms/answer-json";

describe("parseSubmissionAnswerValue", () => {
  it("parses a string answer (text/long_text/dropdown/file)", () => {
    expect(parseSubmissionAnswerValue(JSON.stringify("hello"), "f1")).toBe("hello");
    expect(parseSubmissionAnswerValue(JSON.stringify(""), "f1")).toBe("");
  });

  it("parses a boolean answer (checkbox)", () => {
    expect(parseSubmissionAnswerValue(JSON.stringify(true), "f1")).toBe(true);
    expect(parseSubmissionAnswerValue(JSON.stringify(false), "f1")).toBe(false);
  });

  it("parses a finite number answer (number), including 0 and negatives", () => {
    expect(parseSubmissionAnswerValue(JSON.stringify(42), "f1")).toBe(42);
    expect(parseSubmissionAnswerValue(JSON.stringify(0), "f1")).toBe(0);
    expect(parseSubmissionAnswerValue(JSON.stringify(-3.5), "f1")).toBe(-3.5);
  });

  it("throws a named SubmissionAnswerJsonError on invalid JSON", () => {
    expect(() => parseSubmissionAnswerValue("{not json", "f1")).toThrow(SubmissionAnswerJsonError);
    expect(() => parseSubmissionAnswerValue("{not json", "f1")).toThrow(/f1/);
    expect(() => parseSubmissionAnswerValue("{not json", "f1")).toThrow(/value_json/);
  });

  it("throws on null -- no writer ever stores null (a blank/cleared answer deletes the row instead)", () => {
    expect(() => parseSubmissionAnswerValue(JSON.stringify(null), "f1")).toThrow(SubmissionAnswerJsonError);
  });

  it("throws on an array -- no field kind produces one", () => {
    expect(() => parseSubmissionAnswerValue(JSON.stringify(["a", "b"]), "f1")).toThrow(SubmissionAnswerJsonError);
  });

  it("throws on an object -- no field kind produces one", () => {
    expect(() => parseSubmissionAnswerValue(JSON.stringify({ a: 1 }), "f1")).toThrow(SubmissionAnswerJsonError);
  });

  it("throws on a non-finite number -- validate.ts's Number.isFinite gate means no writer ever stores one, but JSON.parse('1e400') still parses to Infinity", () => {
    expect(() => parseSubmissionAnswerValue("1e400", "f1")).toThrow(SubmissionAnswerJsonError);
    expect(() => parseSubmissionAnswerValue("1e400", "f1")).toThrow(/finite/);
  });
});

// --- Source scan: no reader outside this module bare-parses
// submission_answer.value_json. src/server/repo/form-roles.ts's
// roleAnswerLabel (DEC-592's separate role-answer resolver) and
// src/server/repo/forms.ts's countAnswersByOptionValue (deliberately
// shape-tolerant option-usage counting) are explicitly out of scope -- see
// src/forms/answer-json.ts's header. ---

const ROOT = join(__dirname, "..");
const SCAN_DIRS = [join(ROOT, "src", "server", "repo")];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);
const EXCLUDED_FILES = new Set([
  "src/server/repo/form-roles.ts",
  "src/server/repo/forms.ts",
]);
const COLUMN_NAMES = ["valueJson"];
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

describe("submission_answer.value_json single parser scan (DEC-718 amendment, wave 11)", () => {
  it("scans a non-trivial number of files", () => {
    expect(readScanFiles().length).toBeGreaterThanOrEqual(10);
  });

  it("no file under src/server/repo bare-parses submission_answer.value_json, except answer-json.ts and its stated exclusions", () => {
    const problems: string[] = [];
    for (const file of readScanFiles()) {
      if (EXCLUDED_FILES.has(file.path)) continue;
      BARE_PARSE_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BARE_PARSE_RE.exec(file.text))) {
        const line = file.text.slice(0, m.index).split("\n").length;
        problems.push(`${file.path}:${line} bare JSON.parse(...${m[1]}...) -- route through src/forms/answer-json.ts instead`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("negative control: the scan's regex does flag a synthetic bare parse", () => {
    BARE_PARSE_RE.lastIndex = 0;
    expect(BARE_PARSE_RE.test("const x = JSON.parse(row.valueJson);")).toBe(true);
  });
});
