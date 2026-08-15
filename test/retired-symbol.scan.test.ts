// DEC-755 amendment (findings wave 13): the wave-10/w10-b conversion deleted
// SESSION_FORMAT_FIELD_ID and AUDIENCE_LEVEL_FIELD_ID (src/forms/types.ts,
// replaced by the form_field.role column resolved via
// src/server/repo/form-roles.ts) but left them standing in comments and one
// test-local re-declaration across the tree -- a citation to a symbol
// nobody can resolve. This scan walks every file under src/, app/src/,
// test/, migrations/ and scripts/ (code and comments alike, excluding
// docs/ and decisions/, whose historical records stay verbatim) and fails
// loudly, naming file and line, if a BANNED retired identifier reappears
// anywhere. A banned-list scan, not a heuristic -- the guard is exactly as
// narrow as the claim it protects.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SCAN_ROOTS = ["src", "app/src", "test", "migrations", "scripts"].map((d) => join(ROOT, d));

// This file itself must name the banned identifiers to describe them --
// excluded from its own scan so the guard isn't self-tripping.
const SELF = __filename;

export const BANNED_RETIRED_SYMBOLS: readonly { name: string; replacedBy: string }[] = [
  {
    name: "SESSION_FORMAT_FIELD_ID",
    replacedBy: "form_field.role = 'session_format', resolved via src/server/repo/form-roles.ts",
  },
  {
    name: "AUDIENCE_LEVEL_FIELD_ID",
    replacedBy: "form_field.role = 'audience_level', resolved via src/server/repo/form-roles.ts",
  },
];

const SCAN_EXTENSIONS = [".ts", ".tsx", ".sql"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && SCAN_EXTENSIONS.some((ext) => full.endsWith(ext)) && full !== SELF) {
      out.push(full);
    }
  }
  return out;
}

describe("retired symbols never reappear (DEC-755 amendment, wave 13)", () => {
  it("no file under src/, app/src/, test/, migrations/ or scripts/ contains a banned retired identifier, in code or comments", () => {
    const files = SCAN_ROOTS.flatMap((root) => walk(root));
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        for (const banned of BANNED_RETIRED_SYMBOLS) {
          if (line.includes(banned.name)) {
            const rel = relative(ROOT, file);
            offenders.push(
              `${rel}:${index + 1} references retired symbol "${banned.name}" ` +
                `(replaced by ${banned.replacedBy})`,
            );
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("sanity: the detector fires on a positive control containing a banned name", () => {
    const source = "const x = SESSION_FORMAT_FIELD_ID;";
    expect(BANNED_RETIRED_SYMBOLS.some((b) => source.includes(b.name))).toBe(true);
  });
});
