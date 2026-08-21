// DEC-996 (task r1-e): the DirectoryRail stands down at 390 -- the frame's
// phone body is the scrolling headerless card list alone. This is a text
// scan over
// contacts.css (jsdom applies no stylesheet and evaluates no @media rule,
// mirroring contacts-phone-frames.test.ts's own note), pinning:
//
//   1. `.chq-contacts-rail { display: none }` lives inside the file's LAST
//      `@media (max-width: 700px)` block (test/phone-terminal-block.scan.
//      test.ts already proves there is exactly one such block; this file
//      re-derives its bounds independently rather than trusting that).
//   2. No `.chq-contacts-rail` declaration appears anywhere AFTER that
//      block closes -- the cascade trap: a later equal-specificity desktop
//      rule appended below the terminal block would silently win and
//      revive the rail regardless of the phone rule above.
//   3. The desktop `.chq-contacts-rail { display: flex; ... }` rule above
//      the block is byte-unchanged (desktop is frozen, DEC-385
//      single-direction).
//   4. The `.chq-contacts-directory-grid { gap: 0 }` override is
//      positioned AFTER the earlier phone `.chq-contacts-directory-grid`
//      rule (`grid-template-columns: 1fr; gap: 20px;`) in source order, so
//      it is the one that wins the cascade.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const RAW = readFileSync(CSS_PATH, 'utf-8');

/** Comments stripped first -- a stray `{`/`}` inside a comment (this file's
 * own DEC-996 receipt comment quotes CSS declarations) would desynchronise
 * brace-depth scanning. Same idiom as contacts-phone-frames.test.ts's
 * `read()`. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Index of every top-level `@media (max-width: …)` block's opening brace
 * and matching closing brace, in source order. Brace-matched, not
 * regex-bounded, so a nested rule's own `}` can never end the block early. */
function mediaBlocks(css: string): { openBrace: number; closeBrace: number }[] {
  const out: { openBrace: number; closeBrace: number }[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    const openBrace = m.index + m[0].length - 1;
    let depth = 1;
    let i = openBrace + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ openBrace, closeBrace: i - 1 });
  }
  return out;
}

const BLOCKS = mediaBlocks(CSS);

describe('DEC-996: .chq-contacts-rail stands down inside the terminal phone block', () => {
  it('contacts.css has exactly one @media (max-width: 700px) block, and it is the file\'s last one', () => {
    expect(BLOCKS.length).toBeGreaterThan(0);
    const last = BLOCKS[BLOCKS.length - 1]!;
    // Nothing after the terminal block's close brace opens another
    // @media (max-width: …) block.
    const after = CSS.slice(last.closeBrace + 1);
    expect(after).not.toMatch(/@media\s*\(max-width:/);
  });

  // docs/design/Chautauqua Contacts.dc.html:201
  // `flex:1; min-height:0; overflow-y:auto; padding:4px 16px 16px`
  it('`.chq-contacts-rail { display: none }` lives inside that terminal block', () => {
    const last = BLOCKS[BLOCKS.length - 1]!;
    const body = CSS.slice(last.openBrace + 1, last.closeBrace);
    expect(body).toMatch(/\.chq-contacts-rail\s*\{\s*display:\s*none;\s*\}/);
  });

  it('no `.chq-contacts-rail` declaration appears anywhere after the terminal block closes (the cascade trap)', () => {
    const last = BLOCKS[BLOCKS.length - 1]!;
    const after = CSS.slice(last.closeBrace + 1);
    expect(after).not.toMatch(/\.chq-contacts-rail\b/);
  });

  it('the desktop `.chq-contacts-rail { display: flex; ... }` rule above the block is unchanged', () => {
    const first = BLOCKS[0]!;
    const before = CSS.slice(0, first.openBrace);
    expect(before).toMatch(/\.chq-contacts-rail\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*24px;\s*\}/);
  });

  it('the phone `.chq-contacts-directory-grid { gap: 0 }` override is positioned after the earlier phone `grid-template-columns: 1fr; gap: 20px;` rule', () => {
    const last = BLOCKS[BLOCKS.length - 1]!;
    const body = CSS.slice(last.openBrace + 1, last.closeBrace);
    const earlierIdx = body.indexOf('grid-template-columns: 1fr');
    expect(earlierIdx).toBeGreaterThanOrEqual(0);
    const gapZeroMatch = body.match(/\.chq-contacts-directory-grid\s*\{\s*gap:\s*0;\s*\}/);
    expect(gapZeroMatch).not.toBeNull();
    const gapZeroIdx = body.indexOf(gapZeroMatch![0]);
    expect(gapZeroIdx).toBeGreaterThan(earlierIdx);
  });

  it('the rail rule and the gap override live inside the SAME (only) terminal block, not a second one', () => {
    expect(BLOCKS.length).toBe(1);
  });
});
