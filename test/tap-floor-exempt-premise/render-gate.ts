// Contention decomposition (custodian, wave 44): the render-gate tier,
// extracted verbatim from test/tap-floor-exempt-premise.scan.test.ts, no
// behavior change.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Receipt, RosterRow } from "./receipts";
import { REPO_ROOT } from "./population";
import { escapeRe } from "./css-grammar";

// DEC-393 wave-36 (task w36-f): the two live 390 sweep rosters a
// `render-gate` claim is falsified against -- read once at module load, the
// same way the population's ALL_TEXT/ALL_CHUNKS are, so judgeRenderGate's
// real callers never re-touch disk per receipt.
const ADMIN_390_ROSTER = readFileSync(join(REPO_ROOT, "docs/design/audit/admin-390-interactive-offenders-w27.md"), "utf8");
const PUBLIC_390_ROSTER = readFileSync(join(REPO_ROOT, "docs/design/audit/public-390-interactive-offenders-v12.md"), "utf8");

export interface RenderGateDeps {
  exists: (absPath: string) => boolean;
  read: (absPath: string) => string;
  rosterA: string;
  rosterB: string;
}

const REAL_RENDER_GATE_DEPS: RenderGateDeps = {
  exists: existsSync,
  read: (p) => readFileSync(p, "utf8"),
  rosterA: ADMIN_390_ROSTER,
  rosterB: PUBLIC_390_ROSTER,
};

/** DEC-393 wave-36: a `render-gate` claim ("this component never mounts at
 * phone width") is a claim about the TREE's runtime behaviour, not about a
 * CSS floor -- the companion floor-grammar tiers have nothing to say about
 * it. Two tiers, BOTH required to reach VERIFIED:
 *   (i)  the reason names a real receipt test file that exists on disk and
 *        mentions the gated component by name -- an assertion that the
 *        gate is pinned SOMEWHERE executable, not just asserted in prose;
 *   (ii) FALSIFICATION -- the receipted selector's own class token must NOT
 *        appear in either machine-written 390 roster. An element the live
 *        390 sweep actually rendered contradicts a "never mounts" claim by
 *        construction, so that grades FALSE-PREMISE, never a silent pass
 *        (the task's own worked example: a render-gate whose token DOES
 *        appear in a roster). Dependency-injected (`deps`) so synthetic
 *        controls never have to touch a real file on disk (task's own
 *        instruction: synthetic fixtures, never a live row identity). */
export function judgeRenderGate(receipt: Receipt, deps: RenderGateDeps = REAL_RENDER_GATE_DEPS): RosterRow {
  const testFileMatch = receipt.reason.match(/([\w./-]+\.test\.tsx?)/);
  if (!testFileMatch || !testFileMatch[1]) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason names no receipt test file" };
  }
  const testRelPath = testFileMatch[1];
  const testAbsPath = join(REPO_ROOT, testRelPath);
  if (!deps.exists(testAbsPath)) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `named receipt test file ${testRelPath} does not exist on disk` };
  }
  const componentMatch = receipt.reason.match(/\b([A-Z][A-Za-z0-9]+)\.tsx\b/);
  const component = componentMatch?.[1];
  if (!component) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason names no gated component" };
  }
  const testText = deps.read(testAbsPath);
  if (!testText.includes(component)) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `receipt test file ${testRelPath} does not mention ${component}` };
  }
  const selector = receipt.receiptedClasses[0];
  if (!selector) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "no receipted class token to falsify against the 390 rosters" };
  }
  const tokenRe = new RegExp(`\\b${escapeRe(selector)}\\b`);
  if (tokenRe.test(deps.rosterA) || tokenRe.test(deps.rosterB)) {
    const which = tokenRe.test(deps.rosterA) ? "admin-390-interactive-offenders-w27.md" : "public-390-interactive-offenders-v12.md";
    return {
      ...receipt,
      verdict: "FALSE-PREMISE",
      detail: `.${selector} appears in the live 390 roster ${which} -- the sweep actually rendered it at phone width, so "never mounts here" is false`,
    };
  }
  return {
    ...receipt,
    verdict: "VERIFIED",
    detail: `tier (i): ${testRelPath} exists and mentions ${component}; tier (ii): .${selector} does not appear in either live 390 roster`,
  };
}
