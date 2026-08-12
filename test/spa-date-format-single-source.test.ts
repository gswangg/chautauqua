import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-545: app/src/lib/dates.ts is the ONE date/date-time formatter home
// for the SPA. A page that calls toLocaleString/toLocaleDateString/
// toLocaleTimeString directly on a nullable/unvalidated timestamp renders
// the literal "Invalid Date" instead of the DEC-146 em dash, and forks the
// display semantics that dates.ts centralizes. This guard scans every
// app/src file (excluding dates.ts itself and test files) for those bare
// calls; see test/control-class-conformance.test.ts for the scanning
// precedent this follows.

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");
const DATES_MODULE = join(APP_SRC, "lib/dates.ts");

/** Recursively collect .ts/.tsx files under `dir`, skipping test files and dates.ts itself. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && full !== DATES_MODULE) {
      out.push(full);
    }
  }
  return out;
}

const BANNED = ["toLocaleString(", "toLocaleDateString(", "toLocaleTimeString("];

describe("SPA date-time formatting is single-sourced through lib/dates.ts", () => {
  it("no app/src file (other than dates.ts) calls toLocale*() directly", () => {
    const offenders: string[] = [];
    for (const file of glob(APP_SRC)) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        for (const needle of BANNED) {
          if (line.includes(needle)) {
            offenders.push(`${relative(REPO_ROOT, file)}:${idx + 1}: ${line.trim()}`);
          }
        }
      });
    }
    expect(offenders, `Found direct toLocale* calls outside lib/dates.ts:\n${offenders.join("\n")}`).toEqual([]);
  });
});
