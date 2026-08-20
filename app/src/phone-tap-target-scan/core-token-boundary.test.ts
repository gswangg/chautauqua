// Controls for `selectorMentionsToken`'s class-boundary repair (DEC-937,
// wave v12m-w15-g). The predicate used to be `new RegExp(`\\.${token}\\b`)`
// -- `-` is a non-word character, so `\b` matches INSIDE a hyphenated class
// name and every class that is a hyphen-prefix of another wrongly resolved
// against the shorter token's rule (e.g. `.chq-btn-primary` resolving as a
// face of `.chq-btn`, `.chq-speakers-task-edit-panel` resolving as a face of
// `.chq-speakers-task-edit`). The fix swaps `\b` for a negative lookahead
// excluding any following word character OR hyphen: `(?![\w-])`.
//
// This file exists standalone (rather than folding into
// core-exemption.test.ts) per the wave v12m-w15-g task instruction, so this
// lane contends with no sibling lane touching that file.
import { describe, expect, it } from 'vitest';
import { selectorMentionsToken } from './core.js';

describe('selectorMentionsToken class boundary (DEC-937)', () => {
  it('NEGATIVE: a hyphen-extended class does not match the shorter token', () => {
    expect(selectorMentionsToken('.chq-btn-primary', 'chq-btn')).toBe(false);
  });

  it('NEGATIVE: a hyphen-extended class does not match the shorter token (multi-segment)', () => {
    expect(
      selectorMentionsToken('.chq-speakers-task-edit-panel', 'chq-speakers-task-edit'),
    ).toBe(false);
  });

  it('POSITIVE: an exact bare-class selector matches', () => {
    expect(selectorMentionsToken('.chq-btn', 'chq-btn')).toBe(true);
  });

  it('POSITIVE: a compounded class selector matches', () => {
    expect(selectorMentionsToken('.chq-btn.is-on', 'chq-btn')).toBe(true);
  });

  it('POSITIVE: a pseudo-class-suffixed selector matches', () => {
    expect(selectorMentionsToken('.chq-btn:hover', 'chq-btn')).toBe(true);
  });

  it('POSITIVE: a state (:disabled) branch still MENTIONS the token -- boundary correctness is orthogonal to state-filtering', () => {
    // selectorMentionsToken only decides whether the token is present as a
    // real class boundary; whether a :disabled/[attr] branch should be
    // allowed to resolve a RESTING face is a separate concern, filtered by
    // cancelled-padding-face.scan.test.ts's isRestingBranchForToken.
    expect(selectorMentionsToken('.chq-btn:disabled', 'chq-btn')).toBe(true);
  });

  it('POSITIVE: a descendant-combinator selector matches on the ancestor token', () => {
    expect(selectorMentionsToken('.chq-btn .chq-icon', 'chq-btn')).toBe(true);
  });

  it('NEGATIVE: an attribute-suffixed hyphen-extended class does not match the shorter token', () => {
    expect(selectorMentionsToken('.chq-btn-primary[disabled]', 'chq-btn')).toBe(false);
  });
});
