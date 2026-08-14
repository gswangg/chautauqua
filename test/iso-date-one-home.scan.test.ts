// DEC-510 (wave 46 amendment): src/domain/iso-date.ts is the ONLY file
// under src/ allowed to spell a YYYY-MM-DD-shaped regex literal. Two
// grammars for one value means the looser one is the real contract (this
// is exactly the defect the amendment closed: days.ts's isIsoDay used to
// carry its own bare regex, so a calendar-invalid day like '2027-02-30'
// passed the slot/break gate while event.startDate/endDate refused it).
//
// stripComments is copied verbatim (length-preserving, so line numbers
// stay accurate) from test/file-delete-ordering.scan.test.ts.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

const OWNER_FILE = "src/domain/iso-date.ts";

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
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

interface Hit {
  file: string; // repo-relative path
  line: number;
  text: string; // the full line of (comment-stripped) source, for diagnostics
}

// A YYYY-MM-DD-shaped regex literal: four digit-class atoms, a literal
// hyphen, two digit-class atoms, a literal hyphen, two digit-class atoms
// (the \d{4}-\d{2}-\d{2} shape and close variants like [0-9]{4}-[0-9]{2}
// -[0-9]{2} or repeated \d\d\d\d-\d\d-\d\d).
const DATE_REGEX_LITERAL =
  /\/\^?(?:\\d\{4\}|(?:\\d){4})-(?:\\d\{2\}|(?:\\d){2})-(?:\\d\{2\}|(?:\\d){2})\$?\//g;

function scanForDateRegexLiterals(): Hit[] {
  const files: string[] = [];
  walk(join(ROOT, SRC_ROOT), files);

  const hits: Hit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    let match: RegExpExecArray | null;
    DATE_REGEX_LITERAL.lastIndex = 0;
    while ((match = DATE_REGEX_LITERAL.exec(src))) {
      const lineIdx = src.slice(0, match.index).split("\n").length - 1;
      const lines = src.split("\n");
      hits.push({
        file: relative(ROOT, file).split("\\").join("/"),
        line: lineIdx + 1,
        text: (lines[lineIdx] ?? "").trim(),
      });
    }
  }
  return hits;
}

describe("ISO date grammar single-source scan (DEC-510 wave-46 amendment)", () => {
  it("src/domain/iso-date.ts exports isIsoDate and carries the regex (a rename would otherwise make this scan vacuous)", () => {
    const src = readFileSync(join(ROOT, OWNER_FILE), "utf8");
    expect(/export function isIsoDate\(/.test(src)).toBe(true);
    expect(scanForDateRegexLiterals().some((h) => h.file === OWNER_FILE)).toBe(true);
  });

  it("no file under src/ other than src/domain/iso-date.ts contains a YYYY-MM-DD-shaped regex literal", () => {
    const hits = scanForDateRegexLiterals();
    const offenders = hits.filter((h) => h.file !== OWNER_FILE);
    expect(
      offenders,
      offenders.map((h) => `${h.file}:${h.line}: ${h.text}`).join("\n") ||
        "no offending date-regex literal found",
    ).toHaveLength(0);
  });
});
