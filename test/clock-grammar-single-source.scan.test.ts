// DEC-900 amendment (wave 60): minutes-from-midnight clock formatting has
// ONE owner, src/domain/clock.ts, exporting exactly clockHHMM/clockHMM.
// Eleven copies of the same two-line arithmetic (`Math.floor(x / 60)`
// composed with `x % 60`) existed across both bundles before this wave.
// This scan is the regression guard: it fails if any file other than the
// owner composes both halves of that arithmetic, keyed on the SHAPE of the
// computation rather than a function name or comment wording (a rename
// alone can't make the scan vacuous).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const OWNER = join(ROOT, "src", "domain", "clock.ts");
const SCAN_ROOTS = [join(ROOT, "src"), join(ROOT, "app", "src")];

const HOURS_CONSTRUCT = /Math\.floor\(\s*[\w.]+\s*\/\s*60\s*\)/;
const MINUTES_CONSTRUCT = /[\w.\])]+\s*%\s*60\b/;
// A clock FORMATTER (as opposed to e.g. decomposing minutes into numeric
// hour/minute fields for Date.UTC) joins its hour and minute halves with a
// literal colon inside a template string — the "H:MM"/"HH:MM" shape itself.
const COLON_TEMPLATE = /\$\{[^}]*\}\s*:\s*\$\{[^}]*\}/;

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || /\.scan\.test\.tsx?$/.test(path);
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry) && !isTestFile(full)) {
      out.push(full);
    }
  }
}

function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function findOffenders(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) walk(root, files);
  const offenders: string[] = [];
  for (const file of files) {
    if (file === OWNER) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    if (HOURS_CONSTRUCT.test(src) && MINUTES_CONSTRUCT.test(src) && COLON_TEMPLATE.test(src)) {
      offenders.push(relative(ROOT, file).split("\\").join("/"));
    }
  }
  return offenders;
}

describe("clock grammar single-source scan (DEC-900 amendment, wave 60)", () => {
  it("no file other than src/domain/clock.ts composes Math.floor(x / 60) with x % 60", () => {
    const offenders = findOffenders();
    expect(offenders, offenders.join("\n") || "no offender found").toHaveLength(0);
  });

  it("positive control: the owner itself is detected by the shape (sanity check on the regexes)", () => {
    const src = stripComments(readFileSync(OWNER, "utf8"));
    expect(HOURS_CONSTRUCT.test(src)).toBe(true);
    expect(MINUTES_CONSTRUCT.test(src)).toBe(true);
    expect(COLON_TEMPLATE.test(src)).toBe(true);
  });

  it("the owner exports both clockHHMM and clockHMM (a rename can't make this scan vacuous)", () => {
    const src = readFileSync(OWNER, "utf8");
    expect(src.includes("export function clockHHMM(")).toBe(true);
    expect(src.includes("export function clockHMM(")).toBe(true);
  });
});
