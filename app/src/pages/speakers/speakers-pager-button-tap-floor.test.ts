// v12m-w10-jj (DEC-393 wave-135 element-qualification amendment): the
// shared cancelled-padding rule's `.chq-speakers-pager-actions a` selector
// (speakers.css, terminal @media block) matches nothing -- OnboardingGrid.tsx
// (:1370-1386) renders the Previous/Next pager controls as
// `<button type="button" className="chq-btn chq-btn-secondary">`, never an
// `<a>`. That left the two buttons with no phone tap floor at all: inside
// `.chq-speakers-pager-actions { gap: 29px }` next to the pager row's three
// text siblings, they collapsed to a 42x142 character-by-character column at
// 390. This file pins the fix: `.chq-speakers-pager` wraps at phone width so
// the actions get their own line, and a dedicated element-qualified rule
// floors the real `<button>`.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert';
import { DEC_393 } from '../../../../src/decisions';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

void DEC_393; // the phone tap floor is ELEMENT-qualified: a rule naming `a` does not floor a `<button>`

const HERE = __dirname;
const SPEAKERS_CSS = stripCssComments(readFileSync(join(HERE, 'speakers.css'), 'utf8'));
const ONBOARDING_GRID = readFileSync(join(HERE, 'OnboardingGrid.tsx'), 'utf8');

function lastPhoneBlock(css: string): string {
  const blocks: string[] = [];
  const re = /@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const captured = m[1];
    assert(captured !== undefined);
    blocks.push(captured);
  }
  expect(blocks.length, 'expected at least one phone block').toBeGreaterThan(0);
  const last = blocks[blocks.length - 1];
  assert(last !== undefined);
  return last;
}

const SPEAKERS_PHONE_BLOCK = lastPhoneBlock(SPEAKERS_CSS);

function lastRuleBody(block: string, selectorPattern: RegExp): string {
  const matches = [...block.matchAll(selectorPattern)];
  expect(matches.length, `expected at least one match for ${selectorPattern}`).toBeGreaterThan(0);
  const body = matches[matches.length - 1]![1];
  assert(body !== undefined);
  return body;
}

describe('speakers.css pager button tap floor (v12m-w10-jj, DEC-393 wave-135)', () => {
  it('OnboardingGrid.tsx renders the pager actions as real <button>s, never <a>, confirming the dead selector', () => {
    expect(ONBOARDING_GRID).toMatch(
      /<div className="chq-speakers-pager-actions">[\s\S]{0,400}<button/,
    );
    expect(ONBOARDING_GRID).not.toMatch(
      /<div className="chq-speakers-pager-actions">[\s\S]{0,400}<a[\s>]/,
    );
  });

  it('.chq-speakers-pager gains flex-wrap in the terminal phone block', () => {
    const body = lastRuleBody(SPEAKERS_PHONE_BLOCK, /\.chq-speakers-pager\s*\{([^}]*)\}/g);
    expect(body).toMatch(/flex-wrap:\s*wrap/);
  });

  it('.chq-speakers-pager-actions button carries the 44px floor with centred flex, horizontal padding, and nowrap', () => {
    const body = lastRuleBody(SPEAKERS_PHONE_BLOCK, /\.chq-speakers-pager-actions button\s*\{([^}]*)\}/g);
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/white-space:\s*nowrap/);
    const paddingMatch = body.match(/padding-inline:\s*(-?\d+)px/);
    expect(paddingMatch, 'padding-inline present').not.toBeNull();
    expect(Number(paddingMatch![1])).toBeGreaterThan(0);
  });

  it('the declared 29px pager-actions gap is untouched (relief is wrapping, never a shrunk DECLARED gap)', () => {
    const body = lastRuleBody(SPEAKERS_PHONE_BLOCK, /\.chq-speakers-pager-actions\s*\{([^}]*)\}/g);
    expect(body).toMatch(/gap:\s*29px/);
  });

  it('the dead .chq-speakers-pager-actions a selector is left in place, not element-broadened (DEC-937 painted-face reasoning)', () => {
    expect(SPEAKERS_PHONE_BLOCK).toMatch(/\.chq-speakers-pager-actions a,/);
    // The dedicated button rule is its own top-level construct, not merged
    // into the dead-selector comma group.
    const groupMatch = SPEAKERS_PHONE_BLOCK.match(
      /\.chq-speakers-head-actions a,\s*\.chq-speakers-pager-actions a,[\s\S]*?\{[^}]*\}/,
    );
    expect(groupMatch).not.toBeNull();
    expect(groupMatch![0]).not.toMatch(/button/);
  });
});
