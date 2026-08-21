// DEC-957: one count grammar across the app/ boundary. Every "N noun(s)"
// hand-copied ternary drifts eventually (a stray "1 days ago", an
// un-pluralized "collected answer(s)"). This guard bans the raw `(s)`
// parenthetical from every .ts/.tsx source file under src/ and app/src, so
// new copy is forced through plural()/countOf() (src/domain/count-copy.ts,
// crossed into the SPA via app/src/lib/plural.ts per DEC-660's precedent).
//
// The regex requires a letter immediately before "(s)" -- `.map((s) =>`
// does NOT match, since the character before "(s)" there is "(", not a
// letter.
//
// DEC-374 (wave-152 amendment): this scan's subject is USER-FACING COPY,
// not the comment prose that documents it -- exactly this file's own
// header, above, says "so new copy is forced through plural()/countOf()".
// Grading a comment sentence as if it were rendered copy is the mirror of
// the CSS-comment bug the same amendment fixed elsewhere. Every file is
// now comment-stripped (string/template-literal aware, `//` and `/* */`,
// via the ONE shared test/comment-strip.ts helper -- DEC-613, no private
// second copy) before PATTERN is applied, so a `(s)` sitting only in a
// comment (e.g. src/routes/public/submit-post.tsx:573's "track(s)")
// legitimately never trips this guard again.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_374, DEC_957 } from "../src/decisions";
import { capitalizeFirst, countOf, overBudgetBy, plural } from "../src/domain/count-copy";
import { stripComments } from "./comment-strip";

void DEC_957; // this scan's whole reason to exist: one count grammar, no hand-copied `(s)`
void DEC_374; // comments are stripped before matching -- this scan's subject is copy, not prose about copy

const REPO_ROOT = join(__dirname, "..");

/** Recursively collect .ts/.tsx files under `dir`, skipping dev/, scripts/,
 * and *.test.* files. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "dev" || entry === "scripts") continue;
      out.push(...glob(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

const files = [...glob(join(REPO_ROOT, "src")), ...glob(join(REPO_ROOT, "app/src"))];

// w32-e: src/routes/tasks.ts's cron Error() message and src/routes/dev/
// mailbox.tsx's page caption (previously invisible to this scan -- its glob
// skips dev/) were both converted to countOf() rather than allowlisted; see
// test/plural-scan.test.ts for the src/-only mirror that does not skip dev/.
const EXCEPTIONS = new Set<string>([]);

interface Violation {
  file: string;
  line: number;
  text: string;
}

const PATTERN = /[A-Za-z]\(s\)/;

function scanFile(file: string): Violation[] {
  const violations: Violation[] = [];
  // Comment-stripped (DEC-374): line numbers stay correct because
  // stripComments preserves every physical newline, including ones
  // swallowed inside a multi-line block comment.
  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    if (PATTERN.test(line)) {
      violations.push({ file, line: i + 1, text: line.trim() });
    }
  });
  return violations;
}

describe("one count grammar across the app/ boundary (DEC-957)", () => {
  it("scanned at least 1 file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no raw '(s)' parenthetical survives outside plural()/countOf()", () => {
    const violations: Violation[] = [];
    for (const file of files) {
      if (EXCEPTIONS.has(file)) continue;
      violations.push(...scanFile(file));
    }
    const message = violations.map((v) => `${v.file}:${v.line}: ${v.text}`).join("\n");
    expect(violations, `\n${message}`).toEqual([]);
  });

  it(".map((s) => ...) never trips the guard (preceding char is '(', not a letter)", () => {
    expect(PATTERN.test(".map((s) => s.trim())")).toBe(false);
  });

  // DEC-374 (wave-152 amendment): the two controls this ruling requires --
  // a real violation in a string literal / JSX text still trips the guard
  // after comment-stripping (positive), and the same token sitting only
  // inside a `//` or `/* */` comment does not (negative).
  it("[DEC-374 positive control] a raw '(s)' in a string literal is still caught after comment-stripping", () => {
    const fixture = 'const label = "confirm the talk\'s format, track(s) and audience";';
    const stripped = stripComments(fixture);
    expect(PATTERN.test(stripped)).toBe(true);
  });

  it("[DEC-374 positive control] a raw '(s)' in JSX text is still caught after comment-stripping", () => {
    const fixture = "const el = <p>Pick your track(s) below.</p>;";
    const stripped = stripComments(fixture);
    expect(PATTERN.test(stripped)).toBe(true);
  });

  it("[DEC-374 negative control] a raw '(s)' inside a // comment is not flagged once comments are stripped", () => {
    const fixture = "// confirmation card states the talk's format, track(s) and audience\nconst x = 1;";
    const stripped = stripComments(fixture);
    expect(stripped.split("\n").some((line) => PATTERN.test(line))).toBe(false);
  });

  it("[DEC-374 negative control] a raw '(s)' inside a /* */ block comment is not flagged once comments are stripped", () => {
    const fixture = "/* track(s) must never starve -- see DEC-919 */\nconst y = 2;";
    const stripped = stripComments(fixture);
    expect(stripped.split("\n").some((line) => PATTERN.test(line))).toBe(false);
  });

  it("countOf/plural produce the correct singular/plural noun", () => {
    expect(countOf(1, "session")).toBe("1 session");
    expect(countOf(0, "session")).toBe("0 sessions");
    expect(countOf(2, "session")).toBe("2 sessions");
    expect(countOf(1, "person", "people")).toBe("1 person");
    expect(plural(1, "person", "people")).toBe("person");
    expect(plural(2, "person", "people")).toBe("people");
  });

  // w59-b: moved from app/src/pages/overview/rows.test.ts when its local
  // capitalizeFirst declaration was deleted in favor of this, the ONE owner
  // (DEC-957 amendment, wave 56).
  it("capitalizeFirst upper-cases the first letter and leaves the rest alone", () => {
    expect(capitalizeFirst("four")).toBe("Four");
    expect(capitalizeFirst("one")).toBe("One");
  });

  it("capitalizeFirst is a no-op on an empty string", () => {
    expect(capitalizeFirst("")).toBe("");
  });

  // DEC-422 (amendment): overBudgetBy is the ONE overage-phrase helper for
  // every field-length refusal, singular and plural.
  it("overBudgetBy pluralizes correctly for 1 vs many characters over", () => {
    expect(overBudgetBy(201, 200)).toBe("1 character over");
    expect(overBudgetBy(234, 200)).toBe("34 characters over");
  });

  it("overBudgetBy throws when the value does not exceed the max", () => {
    expect(() => overBudgetBy(200, 200)).toThrow();
    expect(() => overBudgetBy(100, 200)).toThrow();
  });
});
