// Tree-resolution helpers, split out of test/deviations-ledger.scan.test.ts
// (contention decomposition, no behavior change). Each resolver checks one
// ledger row's claim against the real filesystem, rooted at `root`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripTsComments } from "../helpers/strip-ts-comments";

export function fileExists(root: string, p: string): boolean {
  try {
    readFileSync(join(root, p), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function fileContains(root: string, file: string, literal: string): boolean {
  // NOT stripped, deliberately: unlike this module's other resolvers, a
  // "present" citation's literal is legitimately allowed to live in a
  // comment (e.g. a deliberate-non-build note explaining a DEC ruling in
  // prose) -- stripping here would turn real, honored citations into false
  // "does not contain" problems. This resolver's risk direction is the
  // opposite of the unstripped-source-regex family's (DEC-374/DEC-808
  // wave-45): termAppearsInTree below carries this file's genuine repair.
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
      // Stripped (DEC-374/DEC-808 wave-45, unstripped-source-regex repair):
      // a comment merely QUOTING the term (e.g. this very family's own
      // header prose naming a forbidden identifier as an example) must
      // never be mistaken for the term genuinely appearing as live code --
      // the exact risk this instrument's family exists to catch.
      const text = stripTsComments(readFileSync(file, "utf8"));
      if (text.toLowerCase().includes(needle)) return true;
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
