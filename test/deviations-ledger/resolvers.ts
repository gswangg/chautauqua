// Tree-resolution helpers, split out of test/deviations-ledger.scan.test.ts
// (contention decomposition, no behavior change). Each resolver checks one
// ledger row's claim against the real filesystem, rooted at `root`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function fileExists(root: string, p: string): boolean {
  try {
    readFileSync(join(root, p), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function fileContains(root: string, file: string, literal: string): boolean {
  const text = readFileSync(join(root, file), "utf8");
  return text.includes(literal);
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ABSENCE_ROOTS = ["src", "app/src"];

export function termAppearsInTree(root: string, term: string): boolean {
  const needle = term.toLowerCase();
  for (const absenceRoot of ABSENCE_ROOTS) {
    for (const file of walkTsFiles(join(root, absenceRoot))) {
      if (readFileSync(file, "utf8").toLowerCase().includes(needle)) return true;
    }
  }
  return false;
}

export function literalAppearsInDeviations(deviationsText: string, literal: string): boolean {
  return deviationsText.includes(literal);
}

/** Derived, not hand-classified (DEC-967 wave-145): true when a bullet's
 * lead-in phrase itself asserts, in the exact grammatical shape this
 * document's own bullets use for a blessed non-build, that something is
 * explicitly NOT built -- "no <noun phrase> is minted/built/sent/reachable"
 * or "must not appear". A bullet matching this pattern makes a claim with a
 * negative half, and that half needs its own citation -- not just a
 * positive citation of some other, always-true fact standing in for it. */
export function bulletAssertsNonBuild(leadIn: string): boolean {
  return /\bno\b[^.]*\b(?:is|are)\s+(?:minted|built|sent|reachable)\b/i.test(leadIn) || /\bmust not appear\b/i.test(leadIn);
}
