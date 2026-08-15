// DEC-387: README.md's "Dev: render-sweep gate" section makes two claims
// that must never drift silently from the code that governs them:
//   (a) the tap-target height every mobile-pass control must clear (mirrors
//       scripts/render-sweep-lib.ts's MIN_TAP_TARGET_PX)
//   (b) whether the admin mobile pass currently blocks the gate's exit code
//       (mirrors scripts/render-sweep-lib.ts's ADMIN_MOBILE_PASS_BLOCKING)
// w9-a filed this after finding the README asserting ">= 40px" (the code
// says 44) and asserting the admin pass constant "lands `false`" (it is
// `true` — the DEC-431 flip already landed). This test reads README.md as
// text so a future edit that reintroduces a stale number/phrase fails loudly
// instead of silently drifting again.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ADMIN_MOBILE_PASS_BLOCKING, MIN_TAP_TARGET_PX } from "../scripts/render-sweep-lib";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = resolve(REPO_ROOT, "README.md");

const SECTION_HEADING = "### Dev: render-sweep gate";

/** Isolates the render-sweep gate section: from SECTION_HEADING up to (not
 * including) the next `##`/`###` heading, matching the audit-claims.test.ts
 * section-extraction style. */
function extractRenderSweepSection(markdown: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === SECTION_HEADING);
  if (startIdx === -1) {
    throw new Error(`README.md has no "${SECTION_HEADING}" heading`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => /^#{2,3}\s/.test(l));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

/** Every `>= Npx tall` / `>= N px tall` tap-target claim's captured N. */
function extractTapTargetClaims(section: string): number[] {
  const re = />=\s*(\d+)\s*px\s*tall/g;
  const found: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    found.push(Number(m[1]));
  }
  return found;
}

describe('README.md "Dev: render-sweep gate" section vs scripts/render-sweep-lib.ts (DEC-387)', () => {
  const readmeText = readFileSync(README_PATH, "utf-8");
  const section = extractRenderSweepSection(readmeText);
  const tapTargetClaims = extractTapTargetClaims(section);

  it("the section is non-empty (sanity: these checks would be vacuous otherwise)", () => {
    expect(section.trim().length).toBeGreaterThan(0);
  });

  it("found at least one tap-target claim and one blocking claim (sanity floor: a future rewrite that deletes the sentences must fail, not pass vacuously)", () => {
    expect(tapTargetClaims.length, `no ">= N px tall" claim found in:\n${section}`).toBeGreaterThan(0);
    const blockingClauseFound = /constant lands `(true|false)`/.test(section);
    expect(blockingClauseFound, `no "constant lands \`true|false\`" claim found in:\n${section}`).toBe(true);
  });

  it("every tap-target claim in the section equals MIN_TAP_TARGET_PX", () => {
    const offenders = tapTargetClaims.filter((n) => n !== MIN_TAP_TARGET_PX);
    expect(
      offenders,
      `README.md's render-sweep gate section claims a tap-target size (${offenders.join(", ")}) that ` +
        `does not match MIN_TAP_TARGET_PX (${MIN_TAP_TARGET_PX}) in scripts/render-sweep-lib.ts. ` +
        `Section text:\n${section}`,
    ).toEqual([]);
  });

  it("the admin-mobile-pass blocking claim matches ADMIN_MOBILE_PASS_BLOCKING", () => {
    const match = /constant lands `(true|false)`/.exec(section);
    expect(match, `no "constant lands \`true|false\`" clause found in:\n${section}`).not.toBeNull();
    const claimedBlocking = match![1] === "true";
    expect(
      claimedBlocking,
      `README.md claims ADMIN_MOBILE_PASS_BLOCKING lands \`${match![1]}\` but the constant in ` +
        `scripts/render-sweep-lib.ts is actually ${ADMIN_MOBILE_PASS_BLOCKING}. Offending line: ` +
        `${section.split("\n").find((l) => l.includes("constant lands"))}`,
    ).toBe(ADMIN_MOBILE_PASS_BLOCKING);
  });
});
