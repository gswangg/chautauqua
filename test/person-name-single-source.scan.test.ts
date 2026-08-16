// DEC-757 wave-5 amendment: ONE OWNER for a person's display name.
// src/domain/person-name.ts is the sole place a firstName/lastName pair is
// joined into a display string -- every other reader must call personName
// / personNameOrEmail rather than hand-rolling a
// `firstName && lastName ? ... : <fallback>` LADDER. That ladder is the
// defect this wave closed (src/routes/me.ts, src/domain/review-identity.ts
// both required BOTH parts and otherwise fell through to email), because
// DEC-986's single public Name control legitimately produces a mononym
// (only one of the two parts present) that is never rejected -- the ladder
// silently demotes that real person to "no name".
//
// This scan does NOT ban the 57 already-correct
// `${firstName} ${lastName}`.trim() JOIN sites (DEC-757's own scope note:
// the defect is the both-required ladder, not the join). It walks non-test
// modules under src/** and app/src/** and fails on any
// `firstName && <...> lastName ?` / `lastName && <...> firstName ?`
// conditional outside src/domain/person-name.ts, comments stripped first,
// with a synthetic violating snippet and a compliant snippet as controls
// (DEC-518's negative-control convention).

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const APP_SRC_ROOT = join(ROOT, "app", "src");
const OWNER_ABS = join(SRC_ROOT, "domain", "person-name.ts");
const OWNER_REL = "src/domain/person-name.ts";

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function isDecisionsDataFile(path: string): boolean {
  return /[\\/]decisions-data[\\/]/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !isTestFile(full) &&
      !isDecisionsDataFile(full)
    ) {
      out.push(full);
    }
  }
  return out;
}

// Strips // line comments and /* */ block comments (not perfectly
// string-literal-safe, but adequate for this repo's source style -- the
// answer-text and cap-copy sibling scans use the same tradeoff).
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// The both-required ladder: `firstName && <...anything but a statement
// boundary...> lastName ?` in either name order. Matched over a bounded
// window so a reformatted / renamed-receiver copy still trips it, without
// crossing a statement boundary ({ } ;) into an unrelated conditional.
function declaresBothRequiredLadder(source: string): boolean {
  const forward = /\bfirstName\b[^;{}]*&&[^;{}]*\blastName\b[^;{}]*\?/;
  const backward = /\blastName\b[^;{}]*&&[^;{}]*\bfirstName\b[^;{}]*\?/;
  return forward.test(source) || backward.test(source);
}

describe("person-name single source (DEC-757, wave 5)", () => {
  it("the owner module exists and exports personName and personNameOrEmail", () => {
    const source = readFileSync(OWNER_ABS, "utf8");
    expect(source).toMatch(/export function personName\(/);
    expect(source).toMatch(/export function personNameOrEmail\(/);
  });

  it("positive control: the detector fires on a synthetic both-required ladder", () => {
    const violating = `
      const name = row.firstName && row.lastName
        ? \`\${row.firstName} \${row.lastName}\`
        : row.email;
    `;
    expect(declaresBothRequiredLadder(stripComments(violating))).toBe(true);
  });

  it("negative control: the detector does not fire on a plain join or a single-name check", () => {
    const compliant = `
      const name = \`\${(c.firstName ?? "").trim()} \${(c.lastName ?? "").trim()}\`.trim();
      const hasFirst = row.firstName ? true : false;
    `;
    expect(declaresBothRequiredLadder(stripComments(compliant))).toBe(false);
  });

  it("comments containing the ladder shape don't trip the detector", () => {
    const commented = `
      // const name = row.firstName && row.lastName ? "both" : row.email;
      const ok = true;
    `;
    expect(declaresBothRequiredLadder(stripComments(commented))).toBe(false);
  });

  it("no file under src/ or app/src (outside the owner) declares the both-required ladder", () => {
    const files = [...walk(SRC_ROOT), ...walk(APP_SRC_ROOT)].filter((f) => f !== OWNER_ABS);
    const offenders = files
      .filter((f) => declaresBothRequiredLadder(stripComments(readFileSync(f, "utf8"))))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("sanity: the owner path referenced above matches the real relative path", () => {
    expect(relative(ROOT, OWNER_ABS).split(sep).join("/")).toBe(OWNER_REL);
  });
});
