// DEC-987: the server-package mirror of app/src/lib/plural.test.ts's ternary
// guard. One pluralization vocabulary per package -- src/domain/count-copy.ts
// is the ONE home for the count-phrase helpers on this side of the app/ ->
// src/ boundary (app/src/lib/plural.ts re-exports it, DEC-957), so no other
// file under src/ may hand-roll a `? '' : 's'` ternary or a raw '(s)' count
// phrase. This scan does NOT skip src/routes/dev/ (unlike count-grammar.test
// .ts's glob) and carries no per-file exceptions beyond count-copy.ts and
// this test itself -- both known offenders (tasks.ts, dev/mailbox.tsx) are
// fixed in this same task rather than allowlisted.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "./source-comments";

const SRC_ROOT = join(__dirname, "..", "src");
const ALLOWLIST = new Set(["domain/count-copy.ts"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (relative(SRC_ROOT, full) === "decisions-data") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

const TERNARY_PATTERN = /\?\s*['"]{2}\s*:\s*['"]s['"]/;
const PAREN_S_PATTERN = /[A-Za-z]\(s\)/;

describe("no hand-copied pluralization vocabulary outside count-copy.ts (DEC-987)", () => {
  it("scanned at least 1 file", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("bans `? '' : 's'` ternaries and raw '(s)' phrases outside the allowlist", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file);
      if (ALLOWLIST.has(rel)) continue;
      // DEC-374 (wave-147 amendment): this scan's subject is user-facing
      // COPY, and a comment is not product. Same shared string-aware helper
      // count-grammar.test.ts uses -- never a private regex copy (DEC-613).
      const contents = stripSourceComments(readFileSync(file, "utf8"));
      if (TERNARY_PATTERN.test(contents) || PAREN_S_PATTERN.test(contents)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  // DEC-374 (wave-147 amendment): both controls land with the conversion.
  it("[positive control] a real ternary/'(s)' in copy is still caught after stripping", () => {
    const ternary = `const label = n + " item" + (n === 1 ? '' : 's');`;
    const parenS = `const label = "collected answer(s)";`;
    expect(TERNARY_PATTERN.test(stripSourceComments(ternary))).toBe(true);
    expect(PAREN_S_PATTERN.test(stripSourceComments(parenS))).toBe(true);
  });

  it("[negative control] the same vocabulary inside a comment is NOT caught", () => {
    const commented = `// n === 1 ? '' : 's' was the old hand-rolled shape for answer(s)\n/* and track(s) here */\nconst x = 1;`;
    const stripped = stripSourceComments(commented);
    expect(TERNARY_PATTERN.test(stripped)).toBe(false);
    expect(PAREN_S_PATTERN.test(stripped)).toBe(false);
  });
});
