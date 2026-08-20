// Synthetic-fixture controls for tapTargetTagTokens's `anchorNeedsBtnToken`
// parameter (DEC-393 + DEC-976 wave-138; DEC-613 + DEC-989 wave-139).
//
// A bare `<a>` IS the control on the SSR surfaces -- there is no `.chq-btn`
// control-face primitive there the way app/src has. The repair is a
// PARAMETER on the one shared extractor (tapTargetTagTokens), never a fork
// and never a widened shared default: widening the default would drag four
// SPA ratchets (base tap-target, undeclared-height, anchor-floor, SSR
// sub-floor) into a population where the SPA carve-out is correct.
//
// These controls live over SYNTHETIC fixtures, not a live product count --
// a `toBeGreaterThan(0)` over a real number is itself a sentinel (field
// guide w126); the actual SSR population change is asserted separately by
// the SSR ceiling/tripwire tests in ./phone-tap-target-ssr.scan.test.ts, so
// this file does not contend with the drain lanes touching that ceiling.
import { describe, expect, it } from 'vitest';
import { tapTargetTagTokens } from './core.js';

describe('tapTargetTagTokens anchorNeedsBtnToken parameter (synthetic fixtures)', () => {
  it('drops a bare <a> with no chq-btn token by default (SPA behaviour, unchanged)', () => {
    const src = '<a className="chq-x">Link</a>';
    expect(tapTargetTagTokens(src)).toEqual([]);
    expect(tapTargetTagTokens(src, undefined)).toEqual([]);
  });

  it('admits a bare <a> with no chq-btn token when anchorNeedsBtnToken is false (SSR behaviour)', () => {
    const src = '<a className="chq-x">Link</a>';
    expect(tapTargetTagTokens(src, undefined, { anchorNeedsBtnToken: false })).toEqual(['chq-x']);
  });

  it('admits an <a> composing chq-btn either way', () => {
    const src = '<a className="chq-btn chq-x">Link</a>';
    expect(tapTargetTagTokens(src)).toEqual(['chq-btn', 'chq-x']);
    expect(tapTargetTagTokens(src, undefined, { anchorNeedsBtnToken: false })).toEqual(['chq-btn', 'chq-x']);
  });

  it('leaves <button> and <input> unaffected by the flag', () => {
    const btn = '<button className="chq-y">Go</button>';
    expect(tapTargetTagTokens(btn)).toEqual(['chq-y']);
    expect(tapTargetTagTokens(btn, undefined, { anchorNeedsBtnToken: false })).toEqual(['chq-y']);

    const input = '<input className="chq-z" />';
    expect(tapTargetTagTokens(input)).toEqual(['chq-z']);
    expect(tapTargetTagTokens(input, undefined, { anchorNeedsBtnToken: false })).toEqual(['chq-z']);
  });
});
