// v12m-w12-dd (DEC-991/DEC-989 overflow drain): neutralises the
// `phone-horizontal-overflow.scan.test.ts` offender at
// `.chq-speakers-pager-actions button` -- a `white-space: nowrap`
// declaration with no `overflow`/`text-overflow` escape in the same rule.
// The wrap fix landed by v12m-w10-jj (DEC-393 wave-135, see
// speakers-pager-button-tap-floor.test.ts) is CORRECT and must survive: the
// escape added here can never actually fire, since `.chq-speakers-pager`
// already wraps to give the two buttons their own line at 390. This file
// pins that both the tap floor and the overflow escape live together in the
// same rule body, inside the terminal phone block, per DEC-991's wave-119
// amendment (neutralise with a real declaration, never an
// `overflow-exempt:` comment).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../phone-tap-target-scan/core';

const HERE = __dirname;
const SPEAKERS_CSS = readFileSync(join(HERE, 'speakers.css'), 'utf8');
const SPEAKERS_CSS_STRIPPED = stripComments(SPEAKERS_CSS);

// Same technique as speakers-pager-button-tap-floor.test.ts (this cluster):
// capture every top-level `@media (max-width: 700px) { ... }` block
// (single-level brace nesting, which is all this file uses) and take the
// LAST one -- the terminal phone block per DEC-385.
function lastPhoneBlock(css: string): string {
  const blocks: string[] = [];
  const re = /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    blocks.push(m[1]!);
  }
  expect(blocks.length, 'expected at least one phone block').toBeGreaterThan(0);
  return blocks[blocks.length - 1]!;
}

function lastRuleBody(block: string, selectorPattern: RegExp): string {
  const matches = [...block.matchAll(selectorPattern)];
  expect(matches.length, `expected at least one match for ${selectorPattern}`).toBeGreaterThan(0);
  return matches[matches.length - 1]![1]!;
}

const SPEAKERS_PHONE_BLOCK = lastPhoneBlock(SPEAKERS_CSS_STRIPPED);

describe('speakers.css pager button overflow escape (v12m-w12-dd, DEC-991/DEC-989)', () => {
  it('the .chq-speakers-pager-actions button rule sits inside the terminal phone block, not at top level', () => {
    expect(SPEAKERS_PHONE_BLOCK).toMatch(/\.chq-speakers-pager-actions button\s*\{/);
    // Only one such rule exists across the whole (comment-stripped) file --
    // it is not duplicated outside the phone block.
    const wholeFileMatches = [
      ...SPEAKERS_CSS_STRIPPED.matchAll(/\.chq-speakers-pager-actions button\s*\{/g),
    ];
    expect(wholeFileMatches.length).toBe(1);
  });

  it('the rule carries the 44px tap floor together with the nowrap+overflow+ellipsis escape', () => {
    const body = lastRuleBody(
      SPEAKERS_PHONE_BLOCK,
      /\.chq-speakers-pager-actions button\s*\{([^}]*)\}/g,
    );
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/white-space:\s*nowrap/);
    expect(body).toMatch(/overflow:\s*hidden/);
    expect(body).toMatch(/text-overflow:\s*ellipsis/);
  });
});
