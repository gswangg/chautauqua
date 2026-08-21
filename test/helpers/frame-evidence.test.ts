// DEC-374 (wave 18 amendment): controls for isFrameEvidence -- see
// frame-evidence.ts's header for the rule this predicate implements.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isFrameEvidence } from "./frame-evidence";

const REPO_ROOT = join(__dirname, "..", "..");
const DESIGN_DIR = join(REPO_ROOT, "docs", "design");

/** A real, non-trivial line pulled straight from the pack, used as the
 * positive-control fixture below so the test never hand-writes a fixture
 * that might not actually occur in the pack. */
function findRealPackLine(): string {
  for (const entry of readdirSync(DESIGN_DIR)) {
    if (!entry.endsWith(".dc.html")) continue;
    const text = readFileSync(join(DESIGN_DIR, entry), "utf-8");
    for (const raw of text.split("\n")) {
      const trimmed = raw.trim();
      // Want something with real content and no quote characters of its
      // own, so wrapping it in a single-quoted JS string literal below
      // stays unambiguous.
      if (trimmed.length > 20 && !trimmed.includes("'") && !trimmed.includes('"')) {
        return trimmed;
      }
    }
  }
  throw new Error("vacuous-population tripwire: no usable line found in docs/design/*.dc.html");
}

describe("isFrameEvidence (DEC-374 wave-18 amendment)", () => {
  const packLine = findRealPackLine();

  it("vacuous-population tripwire: the pack actually has design files with content", () => {
    const files = readdirSync(DESIGN_DIR).filter((f) => f.endsWith(".dc.html"));
    expect(files.length).toBeGreaterThan(0);
    expect(packLine.length).toBeGreaterThan(0);
  });

  it("a verbatim quote of a real pack line, inside a .test.tsx string literal, IS evidence", () => {
    const sourceLine = `      verbatimLine(1, '${packLine}');`;
    const matchIndex = sourceLine.indexOf(packLine) + 3; // some char inside the literal
    expect(isFrameEvidence("app/src/Fake.render.test.tsx", sourceLine, matchIndex)).toBe(true);
  });

  it("a one-character paraphrase of that same pack line is NOT evidence", () => {
    const paraphrased = `${packLine}!`; // differs by exactly one trailing character
    const sourceLine = `      verbatimLine(1, '${paraphrased}');`;
    const matchIndex = sourceLine.indexOf(paraphrased) + 3;
    expect(isFrameEvidence("app/src/Fake.render.test.tsx", sourceLine, matchIndex)).toBe(false);
  });

  it("the exact same verbatim quote in a NON-test source path is NOT evidence", () => {
    const sourceLine = `      const literal = '${packLine}';`;
    const matchIndex = sourceLine.indexOf(packLine) + 3;
    expect(isFrameEvidence("app/src/Fake.tsx", sourceLine, matchIndex)).toBe(false);
    expect(isFrameEvidence("app/src/Fake.ts", sourceLine, matchIndex)).toBe(false);
  });
});
