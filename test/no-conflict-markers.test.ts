// DEC-849: a committed conflict marker is a build break, not a formatting
// nit. This scans EVERY tracked text file in the repo (walked from the repo
// root, not a hand-listed set of directories -- src/decisions-data/DEC-180.md
// `the population is DERIVED, not listed` -- so a new top-level directory,
// including docs/ and its design-authority frames, joins the population
// automatically instead of silently escaping it) for any line beginning with
// a git conflict marker (<<<<<<<, =======, >>>>>>>) and fails loudly, listing
// file:line, if it finds one. Marker strings are built by repeat()/
// concatenation rather than written literally so this file itself can never
// trip its own scan. The check stays a raw line-prefix test over file TEXT,
// never a parsed-source test -- a marker nested inside a comment (e.g. a
// `/* ... */` block) must still be caught.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
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

// Not-listed, derived: a file joins the scanned population only if it
// decodes as valid UTF-8 text. This is how binary/vendor content (images,
// fonts, anything under public/) is excluded -- by what it IS, not by
// naming its directory or extension.
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
function decodeUtf8OrNull(buf: Uint8Array): string | null {
  try {
    return utf8Decoder.decode(buf);
  } catch {
    return null;
  }
}

describe("no committed conflict markers", () => {
  it("finds no git conflict markers in tracked source trees", () => {
    const allFiles: string[] = [];
    walk(ROOT, allFiles);

    // Vacuous-population tripwire: the widened walk must never silently
    // regress to scanning nothing, and must in particular still reach the
    // design authority this amendment exists to cover.
    expect(allFiles.length).toBeGreaterThan(500);
    const relFiles = allFiles.map((f) => relative(ROOT, f));
    expect(relFiles).toContain(join("docs", "design", "DEVIATIONS.md"));
    expect(relFiles.some((f) => f.startsWith(join("docs", "design")) && f.endsWith(".dc.html"))).toBe(
      true,
    );

    const violations: string[] = [];
    for (const file of allFiles) {
      // Skip this test file's own source -- it constructs marker strings
      // via concatenation above, so a literal-marker scan never matches it,
      // but be explicit anyway.
      if (file === __filename) continue;
      const buf = readFileSync(file);
      const contents = decodeUtf8OrNull(buf);
      if (contents === null) continue;
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
