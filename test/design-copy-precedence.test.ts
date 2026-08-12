// w15-g / mandate item 29: sweep for the "test locks anti-design copy"
// anti-pattern. NotFound.tsx used to carry a comment declaring its render
// test the source of truth over docs/design's copy (kept "Page not found"
// instead of the mock's "That page isn't here") -- RULE: where a test
// contradicts docs/design copy, THE TEST IS WRONG; fix the component and
// move the assertion with it. This is a source-scan test (same pattern as
// test/security-invariants.test.ts) that fails loudly, naming file:line, if
// any source file under app/src or src carries a comment claiming a test
// pins user-visible copy against the design pack -- so the anti-pattern
// can never silently creep back in.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SCAN_DIRS = [resolve(REPO_ROOT, "app/src"), resolve(REPO_ROOT, "src")];

/** Recursively lists every .ts/.tsx file under `dir` (mirrors
 * test/security-invariants.test.ts's listSourceFiles). */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Phrases that indicate a comment is pinning user-visible copy to what a
// test asserts, rather than to docs/design -- the exact anti-pattern named
// in mandate item 29's eval-findings entry (docs/eval-findings.md #29).
const ANTI_PATTERN_PHRASES = [
  /test asserts on it/i,
  /source of truth\)? rather than the design/i,
  /rather than the design doc'?s/i,
  /the test( is)? the source of truth/i,
];

describe("no source file pins user-visible copy against docs/design via a test-is-truth comment (mandate #29)", () => {
  const offenders: string[] = [];

  for (const dir of SCAN_DIRS) {
    for (const file of listSourceFiles(dir)) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        if (ANTI_PATTERN_PHRASES.some((re) => re.test(line))) {
          offenders.push(`${relative(REPO_ROOT, file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }

  it("finds zero occurrences", () => {
    expect(offenders).toEqual([]);
  });
});
