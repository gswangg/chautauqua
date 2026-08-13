// DEC-849: a committed conflict marker is a build break, not a formatting
// nit. This scans the tracked source trees for any line beginning with a
// git conflict marker (<<<<<<<, =======, >>>>>>>) and fails loudly, listing
// file:line, if it finds one. Marker strings are built by repeat()/
// concatenation rather than written literally so this file itself can never
// trip its own scan.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["src", "app/src", "test", "scripts", "migrations", "decisions"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

const CONFLICT_START = "<".repeat(7);
const CONFLICT_MID = "=".repeat(7);
const CONFLICT_END = ">".repeat(7);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
}

describe("no committed conflict markers", () => {
  it("finds no git conflict markers in tracked source trees", () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) {
      const abs = join(ROOT, dir);
      try {
        statSync(abs);
      } catch {
        continue;
      }
      walk(abs, files);
    }

    const violations: string[] = [];
    for (const file of files) {
      // Skip this test file's own source -- it constructs marker strings
      // via concatenation above, so a literal-marker scan never matches it,
      // but be explicit anyway.
      if (file === __filename) continue;
      const contents = readFileSync(file, "utf8");
      const lines = contents.split("\n");
      lines.forEach((line, idx) => {
        if (
          line.startsWith(CONFLICT_START) ||
          line.startsWith(CONFLICT_MID) ||
          line.startsWith(CONFLICT_END)
        ) {
          violations.push(`${relative(ROOT, file)}:${idx + 1}`);
        }
      });
    }

    expect(violations, `committed conflict markers found:\n${violations.join("\n")}`).toEqual([]);
  });
});
