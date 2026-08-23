// DEC-613 wave-56 (task w56-e): the `inline` family reaches this
// instrument's existing no-companion fallthrough exactly as `composition`'s
// judgeBareTokenCompanion does -- but a SIBLING instrument
// (test/inline-prose-exemption-premise/judge.ts's judgeInlineReceipt)
// already resolves the identical `inline-in-prose` population to
// completion, through a self-floored rung, a named-companion rung and a
// DEVIATIONS-section-grounding rung (rung 3), with BOTH of its own ratchets
// reading 0. Rather than a second copy of that grammar (DEC-613), this tier
// calls the sibling's grader directly and maps its four-verdict vocabulary
// onto this instrument's three-verdict one: GROUNDED / GROUNDED-BY-DEVIATION
// -> VERIFIED (a real settled floor claim, naming the sibling grader and the
// rung that settled it); UNGROUNDED -> FALSE-PREMISE (the companion class
// the reason names does NOT carry the floor -- a real 44px defect, never
// softened here, DEC-393 wave-30); UNVERIFIABLE -> UNVERIFIABLE-PREMISE,
// unchanged. Scoped to family === "inline" ONLY: wave-51 already recorded
// that an UNSCOPED companion tier misread `inline`-family reason prose
// (citations tying a receipt to a DEVIATIONS.md entry, not grounding
// assertions) as companion candidates and produced false FALSE-PREMISE
// noise -- this tier never widens beyond the family the sibling
// instrument's own population sweep already targets. Extracted into its own
// file (the same one-tier-per-file idiom element-type.ts/self-scoped.ts/
// render-gate.ts/anchorless-container.ts/self-floored.ts already use) so it
// is directly unit-testable against all four of the sibling's verdicts, not
// only the ones reachable through judgeReceipt's own dot-mention gate.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Receipt, RosterRow } from "./receipts";
import { REPO_ROOT } from "./population";
import type { InlineReceipt } from "../inline-prose-exemption-premise/receipts";
import { judgeInlineReceipt, parseDeviationsSections } from "../inline-prose-exemption-premise/judge";
import type { DeviationSection } from "../inline-prose-exemption-premise/judge";

// DEVIATIONS.md, parsed once at module load via the sibling's own parser
// (DEC-613: never a second copy) so this tier can settle rung 3 (GROUNDED-
// BY-DEVIATION) exactly as the sibling instrument does when run standalone.
const DEVIATIONS_TEXT = readFileSync(join(REPO_ROOT, "docs/design/DEVIATIONS.md"), "utf8");
const REAL_DEVIATIONS_SECTIONS = parseDeviationsSections(DEVIATIONS_TEXT);

export function judgeInlineTier(
  receipt: Receipt,
  allChunks: Array<{ selector: string; body: string }>,
  allText: string,
  deviationSections: DeviationSection[] = REAL_DEVIATIONS_SECTIONS,
): RosterRow | null {
  if (receipt.family !== "inline") return null;
  const inlineReceipt: InlineReceipt = {
    file: receipt.file,
    line: receipt.line,
    reason: receipt.reason,
    receiptedClasses: receipt.receiptedClasses,
  };
  const row = judgeInlineReceipt(inlineReceipt, allChunks, allText, deviationSections);
  if (row.verdict === "GROUNDED" || row.verdict === "GROUNDED-BY-DEVIATION") {
    return {
      ...receipt,
      verdict: "VERIFIED",
      detail: `test/inline-prose-exemption-premise/judge.ts's judgeInlineReceipt resolves this receipt ${row.verdict} (sibling grader, DEC-613): ${row.detail}`,
    };
  }
  if (row.verdict === "UNGROUNDED") {
    return {
      ...receipt,
      verdict: "FALSE-PREMISE",
      detail: `test/inline-prose-exemption-premise/judge.ts's judgeInlineReceipt resolves this receipt UNGROUNDED -- the named companion fails the 44px-floor grammar, a real defect (sibling grader, DEC-613): ${row.detail}`,
    };
  }
  return {
    ...receipt,
    verdict: "UNVERIFIABLE-PREMISE",
    detail: `test/inline-prose-exemption-premise/judge.ts's judgeInlineReceipt resolves this receipt UNVERIFIABLE (sibling grader, DEC-613): ${row.detail}`,
  };
}
