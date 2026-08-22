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

/** w16-qg (DEC-994): the brace-matched body of every top-level
 * `@media (max-width: 700px)` block in `css`, in source order. Callers
 * strip comments first. Promoted from the brace-depth walk spelled inline
 * in `app/src/pages/Contacts.frame-verdicts.render.test.tsx`'s
 * `readContactsPhoneLayer()` (~lines 36-55) so every phone-verdict file
 * shares one instrument instead of re-deriving it. Matches by brace depth
 * from the opener, so a nested at-rule (e.g. `@media (hover: hover)`
 * inside the phone block) never truncates the body early. */
export function phoneMediaBlocks(css: string): string[] {
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media (max-width: 700px) block in CSS input');
    blocks.push(css.slice(start, i - 1));
    opener.lastIndex = i;
  }
  return blocks;
}
