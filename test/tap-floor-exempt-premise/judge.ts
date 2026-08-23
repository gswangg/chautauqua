// Contention decomposition (custodian, wave 44): the top-level judgeReceipt
// dispatcher, extracted verbatim from
// test/tap-floor-exempt-premise.scan.test.ts, no behavior change.
import type { Receipt, RosterRow } from "./receipts";
import { escapeRe, hasFlexCenter, hasMinHeightFloor, hasWidthHeightFloor, horizontalPaddingNonZero, isReplacedContentSelector } from "./css-grammar";
import { judgeElementTypeReason } from "./element-type";
import { judgeSelfScoped } from "./self-scoped";
import { judgeRenderGate } from "./render-gate";

export function judgeReceipt(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>, allText: string): RosterRow {
  if (receipt.family === "other") {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "reason family has no automated predicate this wave (roster row, DEC-393 wave-30 clause (c))" };
  }
  if (receipt.family === "render-gate") {
    return judgeRenderGate(receipt);
  }
  const mentioned = [...receipt.reason.matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string);
  const companion = mentioned.find((c) => !receipt.receiptedClasses.includes(c));
  if (!companion) {
    // DEC-393 wave-40: two more shapes get a real predicate before falling
    // to the generic "no companion class named" verdict.
    if (mentioned.length === 0) {
      const elementTypeRow = judgeElementTypeReason(receipt, allChunks);
      if (elementTypeRow) return elementTypeRow;
    } else if (receipt.family === "scoped") {
      return judgeSelfScoped(receipt, allChunks, allText);
    }
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "no companion class named in the reason (distinct from the receipted selector itself)" };
  }
  const tokenRe = new RegExp(`\\.${escapeRe(companion)}(?![\\w-])`);
  const matchingChunks = allChunks.filter((c) => tokenRe.test(c.selector));
  const bodies = matchingChunks.map((c) => c.body);
  if (bodies.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `companion .${companion} has no discoverable CSS rule` };
  }
  // Merge every rule body mentioning the companion token: this codebase's
  // idiom declares display:flex/align-items:center on a base (desktop) rule
  // and adds min-height/padding on a later grouped phone-media rule for the
  // SAME selector -- the floor is the CASCADE, not any one rule in isolation.
  const merged = bodies.join("\n");
  const flexFloored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  // Second tier (DEC-393 wave-34): a companion the sheet itself styles
  // alongside an `img` element selector carries no text to centre or pad
  // around, so its own width/height (or min-width/min-height) rules reaching
  // >=44px on BOTH axes satisfies the hit-box floor without flex/padding.
  const replacedContent = matchingChunks.some((c) => isReplacedContentSelector(c.selector));
  const widthHeightFloored = replacedContent && hasWidthHeightFloor(merged);
  const floored = flexFloored || widthHeightFloored;
  const present = new RegExp(`\\b${companion}\\b`).test(allText);
  if (floored && present) {
    const detail = flexFloored
      ? `companion .${companion} declares min-height:44px + centred flex + non-zero horizontal padding (merged across ${bodies.length} rule(s)) and appears in real markup`
      : `companion .${companion} is a replaced-content box (co-styled with an img selector) whose own width/height rules put both axes at >=44px (merged across ${bodies.length} rule(s)) and appears in real markup`;
    return { ...receipt, verdict: "VERIFIED", detail };
  }
  if (!floored) {
    return { ...receipt, verdict: "FALSE-PREMISE", detail: `companion .${companion} found (${bodies.length} rule(s), merged) but does not satisfy the 44px-floor grammar (min-height:44px + centred flex + non-zero horizontal padding, or, for a replaced-content companion, own width/height >=44px on both axes)` };
  }
  return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `companion .${companion} is floored but was not found in any product markup source` };
}
