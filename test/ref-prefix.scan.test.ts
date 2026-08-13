// DEC-972: the public CFP confirmation quotes the event's own record prefix
// (never a hardcoded literal like "SES"). src/routes/public/submit.tsx used
// to call formatRef("SES", submission.seq) — every event whose recordPrefix
// wasn't literally "SES" got a wrong ref on its confirmation page and email.
// This scanner enumerates every *.ts/*.tsx under src/ (never a hand-listed
// manifest — a file added after this test is written must still be caught)
// and bans any formatRef(...) call whose first argument is a string literal.
// src/domain/ids.ts's own JSDoc example (`formatRef('SES', 14)`) is a
// comment and must be excluded by stripping comments, not by allowlisting
// the file.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(__dirname, "..", "src");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Strips // line comments and /* block comments *\/ from source text so a
 * JSDoc example like `formatRef('SES', 14)` never counts as a live call. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// Matches a formatRef( call whose first argument is a quoted string literal,
// e.g. formatRef("SES", ...) or formatRef('SES', ...).
const LITERAL_FIRST_ARG_RE = /formatRef\(\s*(['"])[^'"]*\1/g;

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

describe("no formatRef(...) call passes a string literal as its prefix (DEC-972)", () => {
  const files = listSourceFiles(SRC_ROOT);

  it("finds source files to scan (scanner sanity check)", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(join(SRC_ROOT, "domain", "ids.ts"));
  });

  it("every formatRef call's first argument is a variable/expression, not a literal", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const stripped = stripComments(raw);
      let match: RegExpExecArray | null;
      LITERAL_FIRST_ARG_RE.lastIndex = 0;
      while ((match = LITERAL_FIRST_ARG_RE.exec(stripped)) !== null) {
        const line = lineOf(stripped, match.index);
        offenders.push(`${relative(SRC_ROOT, file)}:${line}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
