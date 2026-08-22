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

const PHONE_MEDIA_OPENER = /@media\s*\(max-width:\s*700px\)\s*\{/g;

/** DEC-994 w16m: the brace-depth walk four render-verdict files each
 * hand-rolled independently (Contacts.frame-verdicts, Content.frame-verdicts,
 * DeliverableDetail.stack-390, ContentApp.download-all-flex.receipt),
 * promoted to one shared helper. Returns, in source order, the brace-matched
 * BODY of every `@media (max-width: 700px)` block in `css` -- a stylesheet
 * may carry more than one such block (unlike the single-block callers this
 * was copied from), so every caller gets the full list rather than just the
 * first match. Callers strip comments first; this module deliberately does
 * not, so it stays one job (mirrors `splitMediaBlocks` above). */
export function phoneMediaBlocks(css: string): string[] {
  const blocks: string[] = [];
  PHONE_MEDIA_OPENER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_MEDIA_OPENER.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media (max-width: 700px) block in CSS input');
    blocks.push(css.slice(bodyStart, i - 1));
    PHONE_MEDIA_OPENER.lastIndex = i;
  }
  return blocks;
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
