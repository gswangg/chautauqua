// Shared phone-block scanning vocabulary for CSS source pins.
//
// DEC-385 wave-98 requires each sheet to have exactly ONE `@media
// (max-width: 700px)` block, textually terminal. Forward-merging several
// blocks into one broke a family of test helpers that had quietly relied on
// the old shape, in two recurring ways:
//
//   1. Comment-blindness. A merged block carries the provenance comments
//      that used to sit OUTSIDE each block. Those comments quote CSS
//      inline -- braces (`.chq-main{padding}`), the literal `@media`, and
//      commas -- so any regex that walks braces or splits selector lists
//      must run over comment-stripped source or it reads prose as syntax.
//
//   2. Name-presence used as a proxy for a property. "The string X never
//      appears under the breakpoint" was a fair proxy while each block held
//      one concern; after the merge the single block names nearly every
//      token in the sheet for unrelated reasons. Assert the declaration.
//
// One copy of this vocabulary, imported by the pins that need it -- a second
// copy is a trap with a delay fuse (field guide DEC-613).

/** CSS comments carry no declarations; drop them before any structural scan. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The text of the sheet's `@media (max-width: 700px)` block, braces
 * included, comments stripped. Throws if the sheet has no phone block --
 * a pin that scans nothing must fail loudly, not pass vacuously. */
export function phoneBlockText(css: string): string {
  const src = stripCssComments(css);
  const start = src.indexOf('@media (max-width: 700px) {');
  if (start === -1) {
    throw new Error('no `@media (max-width: 700px)` block found in this sheet');
  }
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced `@media (max-width: 700px)` block');
}

export interface PhoneRule {
  selector: string;
  body: string;
}

/** Every rule inside the phone block whose selector list mentions `token`
 * as a class token (so `.chq-x-table .chq-x-col-actions` matches `chq-x`). */
export function phoneBlockRulesMentioning(css: string, token: string): PhoneRule[] {
  const block = phoneBlockText(css);
  const mentions = new RegExp(`\\.${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\w-]*\\b`);
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const out: PhoneRule[] = [];
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(block))) {
    const selector = (m[1] ?? '').trim();
    if (mentions.test(selector)) out.push({ selector, body: m[2] ?? '' });
  }
  return out;
}
