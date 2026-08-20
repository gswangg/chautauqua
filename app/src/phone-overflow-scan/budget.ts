// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): the derived (not guessed)
// 390px phone content budget.
//
// The v12 phone frames are drawn at width:390px (DEC-808). `.chq-main`'s
// own `@media (max-width: 700px)` rule in styles.css sets its phone
// padding -- the ONE place the shell declares the gutter every page's
// content sits inside. Content budget = frame width minus that gutter on
// both sides.
import { phoneMediaBlocks, isPhoneCondition, ruleBodyIn } from './rules';

export const PHONE_FRAME_WIDTH_PX = 390;

export interface ContentBudget {
  gutterPx: number;
  budgetPx: number;
}

/**
 * Derives the phone content budget from styles.css's OWN sanitized text --
 * throws loudly (rather than hardcoding a fallback) if `.chq-main`'s phone
 * rule stops declaring a single-value px padding.
 */
export function deriveContentBudget(sanitizedStylesCss: string): ContentBudget {
  const mainPhoneBlock = phoneMediaBlocks(sanitizedStylesCss).find((b) => isPhoneCondition(b.condition));
  if (!mainPhoneBlock) throw new Error('styles.css has no @media (max-width: <=700px) block');
  const mainPhoneBody = ruleBodyIn(mainPhoneBlock.body, '.chq-main');
  const gutterMatch = mainPhoneBody.match(/(?:^|;)\s*padding:\s*(\d+(?:\.\d+)?)px\s*;/);
  if (!gutterMatch) {
    throw new Error(
      ".chq-main's phone rule no longer declares a single-value px padding -- update the derivation above rather than hardcoding a budget",
    );
  }
  const gutterPx = Number(gutterMatch[1]);
  return { gutterPx, budgetPx: PHONE_FRAME_WIDTH_PX - 2 * gutterPx };
}
