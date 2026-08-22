// Brace-matched @media block splitting for the CSS scans.
//
// The house regex idiom for "strip the @media blocks" --
//
//   /@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g
//
// -- models a media body as exactly ONE level of `selector { ... }` pairs.
// That held for as long as no stylesheet nested an at-rule inside a media
// query. It stopped holding when contacts.css grew three
// `@media (hover: hover)` blocks INSIDE its terminal
// `@media (max-width: 700px)` block: the pattern then fails to match at
// all, so the whole 12KB media block survives "stripping" and every phone
// rule inside it is mistaken for a TOP-LEVEL rule by whichever scan is
// asking. The failure mode is silent and inverted -- a scan does not skip
// work, it invents offenders -- so the fix is a matcher with no depth
// limit rather than a stylesheet forbidden from nesting.
//
// Callers strip comments first (a decision note quoting CSS-shaped text is
// not a rule); this module deliberately does not, so it stays one job.
//
// `resolvePhoneDeclaration` below is the exception: it needs the sheet's
// single terminal phone block (comment-stripped), which is exactly what
// `app/src/test-utils/phoneBlock.ts`'s `phoneBlockText` already provides,
// so it is reused here rather than re-derived (DEC-613).

import { phoneBlockText } from '../../app/src/test-utils/phoneBlock';

export interface MediaSplit {
  /** `css` with every @media block (opener and body) removed. */
  outside: string;
  /** The concatenated BODIES of those blocks, newline-joined. May itself
   * contain nested at-rules -- split again to descend a level. */
  inside: string;
}

const MEDIA_OPENER = /@media[^{;]*\{/g;

/** Splits `css` into the text outside its @media blocks and the bodies of
 * those blocks, matching braces rather than assuming a nesting depth. */
export function splitMediaBlocks(css: string): MediaSplit {
  let outside = '';
  const inside: string[] = [];
  let cursor = 0;
  MEDIA_OPENER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MEDIA_OPENER.exec(css)) !== null) {
    outside += css.slice(cursor, m.index);
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    while (i < css.length && depth > 0) {
      const ch = css[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block in CSS input');
    inside.push(css.slice(bodyStart, i - 1));
    cursor = i;
    MEDIA_OPENER.lastIndex = i;
  }
  outside += css.slice(cursor);
  return { outside, inside: inside.join('\n') };
}

/** Every top-level `@media (max-width: 700px)` block's BODY, in source
 * order, brace-matched so a nested at-rule (e.g. `@media (hover: hover)`)
 * inside one never truncates the slice early. Promoted (DEC-613/DEC-994
 * wave-16) from the private `phoneBlock()`/`detailPhoneBlock()` helpers
 * duplicated across Contacts.frame-verdicts.render.test.tsx,
 * Content.frame-verdicts.render.test.tsx, DeliverableDetail.stack-390.
 * render.test.tsx and ContentApp.download-all-flex.receipt.render.test.tsx
 * -- those single-block callers took only the FIRST match; this returns
 * ALL of them since a stylesheet may declare the same condition more than
 * once ("the terminal block" is not a synonym for "the only block"). */
export function phoneMediaBlocks(css: string): string[] {
  const blocks: string[] = [];
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media (max-width: 700px) block in CSS input');
    blocks.push(css.slice(bodyStart, i - 1));
    opener.lastIndex = i;
  }
  return blocks;
}

/** Splits a comma-separated CSS selector list into its trimmed compound
 * selectors -- never a substring match against the joined list, since a
 * frame-geometry pin must resolve the DECLARATION that governs a named
 * selector regardless of which siblings it is listed beside (DEC-994
 * wave-28 amendment: "adding or reordering a sibling selector can never
 * redden it, and deleting the declaration always does"). */
function splitSelectorList(selector: string): string[] {
  return selector
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Resolves the declared value of `property` on the rule, within the
 * sheet's terminal `@media (max-width: 700px)` block, whose selector list
 * CONTAINS `selector` as a whole compound selector -- never a substring
 * match on the full list text. Throws (fails loudly) if no rule names the
 * selector, or if the rule that does name it never declares `property`,
 * so a lane that deletes the declaration cannot pass silently. A lane
 * that only adds or reorders a sibling selector on the same rule can
 * never change this function's result. */
export function resolvePhoneDeclaration(css: string, selector: string, property: string): string {
  const block = phoneBlockText(css);
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(block)) !== null) {
    const selectors = splitSelectorList(m[1] ?? '');
    if (!selectors.includes(selector)) continue;
    const body = m[2] ?? '';
    const declRe = new RegExp(`(?:^|;)\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+);`);
    const declMatch = declRe.exec(body);
    if (!declMatch) {
      throw new Error(
        `rule for selector "${selector}" in the phone block declares no "${property}" property`,
      );
    }
    return (declMatch[1] ?? '').trim();
  }
  throw new Error(`no rule in the phone block has "${selector}" in its selector list`);
}

/** Every `selector { body }` rule in `css`, at ANY @media nesting depth --
 * the media openers themselves never survive to be read as selectors. */
export function flattenMediaRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const pending = [css];
  while (pending.length > 0) {
    const text = pending.pop()!;
    const { outside, inside } = splitMediaBlocks(text);
    if (inside.length > 0) pending.push(inside);
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(outside)) !== null) {
      rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
    }
  }
  return rules;
}
