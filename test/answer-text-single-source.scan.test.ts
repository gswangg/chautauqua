// DEC-561 (Amendment, wave 60): src/domain/answer-text.ts is the ONE module
// that renders a CFP answer value as text -- two named grammars
// (answerDisplayText for screen, answerExportCell for export), never a
// second hand-rolled copy that branches on Array.isArray(...) and also
// renders a boolean as Yes/No or true/false. This scan proves (a) the owner
// exists and exports both names, (b) the four sites the wave-60 ruling
// re-pointed actually import from the owner, (c) no OTHER file under src/
// or app/src declares a second such function -- with a positive control
// proving the detector fires on the owner itself (so a change that widens
// the owner's shape doesn't silently blind the ban).
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const APP_SRC_ROOT = join(ROOT, "app", "src");
const OWNER_ABS = join(SRC_ROOT, "domain", "answer-text.ts");
const OWNER_REL = "src/domain/answer-text.ts";

const REPOINTED_FILES = [
  join(APP_SRC_ROOT, "pages", "review", "Scorecard.tsx"),
  join(APP_SRC_ROOT, "pages", "submissions", "columns.ts"), // consumers moved off it; columns.ts itself no longer declares it
  join(SRC_ROOT, "server", "repo", "tasks", "response-detail.ts"),
  join(SRC_ROOT, "server", "repo", "exports", "submissions.ts"),
];

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function isDecisionsDataFile(path: string): boolean {
  return /[\\/]decisions-data[\\/]/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !isTestFile(full) &&
      !isDecisionsDataFile(full)
    ) {
      out.push(full);
    }
  }
  return out;
}

// A function body that branches on Array.isArray(<something>) AND renders a
// boolean as a Yes/No or true/false pair -- the signature shape of "another
// answer-to-text renderer". Matched over the whole file text within a
// plausible function-length window rather than requiring a single line, so
// a reformatted copy still trips it.
function declaresAnswerRenderer(source: string): boolean {
  const hasArrayIsArrayBranch = /Array\.isArray\(/.test(source);
  const hasYesNo = /['"]Yes['"]\s*:\s*['"]No['"]|['"]No['"]\s*:\s*['"]Yes['"]/.test(source);
  const hasTrueFalseString = /['"]true['"]\s*:\s*['"]false['"]|['"]false['"]\s*:\s*['"]true['"]/.test(source);
  return hasArrayIsArrayBranch && (hasYesNo || hasTrueFalseString);
}

describe("answer-text single source (DEC-561, wave 60)", () => {
  it("the owner module exists and exports both answerDisplayText and answerExportCell", () => {
    const source = readFileSync(OWNER_ABS, "utf8");
    expect(source).toMatch(/export function answerDisplayText\(/);
    expect(source).toMatch(/export function answerExportCell\(/);
  });

  it("positive control: the detector fires on the owner file itself", () => {
    const source = readFileSync(OWNER_ABS, "utf8");
    expect(declaresAnswerRenderer(source)).toBe(true);
  });

  it("each of the four re-pointed files imports from the owner (or, for columns.ts, no longer declares its own copy)", () => {
    for (const file of REPOINTED_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      if (rel.endsWith("columns.ts")) {
        // columns.ts's own formatAnswerValue was deleted outright (its
        // consumers import the owner directly); prove it no longer declares
        // a second answer renderer at all.
        expect(declaresAnswerRenderer(source)).toBe(false);
        continue;
      }
      expect(source.includes("domain/answer-text")).toBe(true);
    }
  });

  it("no other file under src/ or app/src declares a second answer-to-text renderer", () => {
    const files = [...walk(SRC_ROOT), ...walk(APP_SRC_ROOT)].filter((f) => f !== OWNER_ABS);
    const offenders = files
      .filter((f) => declaresAnswerRenderer(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("sanity: the owner path referenced above matches the real relative path", () => {
    expect(relative(ROOT, OWNER_ABS).split(require("node:path").sep).join("/")).toBe(OWNER_REL);
  });
});
