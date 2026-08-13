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

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countOf, plural } from "../src/domain/count-copy";

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
  const lines = readFileSync(file, "utf8").split("\n");
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

  it("countOf/plural produce the correct singular/plural noun", () => {
    expect(countOf(1, "session")).toBe("1 session");
    expect(countOf(0, "session")).toBe("0 sessions");
    expect(countOf(2, "session")).toBe("2 sessions");
    expect(countOf(1, "person", "people")).toBe("1 person");
    expect(plural(1, "person", "people")).toBe("person");
    expect(plural(2, "person", "people")).toBe("people");
  });
});
