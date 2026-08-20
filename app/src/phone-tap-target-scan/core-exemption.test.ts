// Controls for the `topLevelRulesWithExemption` exemption-flag repair
// (wave v12m-w13-p, DEC-367). The predicate used to test whether `m[0]`
// (the whole matched rule text, including any preceding comment) merely
// STARTED WITH `/*` -- which is true for ANY block comment sitting
// immediately above a rule, not just a literal `tap-floor-exempt:` comment,
// because the exemption comment group in the parsing regex is optional and
// an ordinary comment gets swallowed into the selector-capture group
// instead. See core.ts's `topLevelRulesWithExemption` for the fix and its
// history (wave 124 finding).
import { describe, expect, it } from 'vitest';
import { topLevelRulesWithExemption } from './core.js';

describe('topLevelRulesWithExemption exemption grammar (DEC-367)', () => {
  it('POSITIVE: an ordinary comment above a rule does not exempt it', () => {
    const css = '/* just a normal design comment */\n.chq-x { padding: 0; }';
    const rules = topLevelRulesWithExemption(css);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.selector).toBe('.chq-x');
    expect(rules[0]?.exempt).toBe(false);
  });

  it('NEGATIVE: a real tap-floor-exempt comment exempts the rule it precedes', () => {
    const css = '/* tap-floor-exempt: reason here */\n.chq-y { padding: 0; }';
    const rules = topLevelRulesWithExemption(css);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.selector).toBe('.chq-y');
    expect(rules[0]?.exempt).toBe(true);
  });

  it('NEGATIVE: a tap-floor-exempt comment does not leak onto the next rule', () => {
    const css = [
      '/* tap-floor-exempt: reason here */',
      '.chq-y { padding: 0; }',
      '.chq-z { padding: 0; }',
    ].join('\n');
    const rules = topLevelRulesWithExemption(css);
    expect(rules).toHaveLength(2);
    const y = rules.find((r) => r.selector === '.chq-y');
    const z = rules.find((r) => r.selector === '.chq-z');
    expect(y?.exempt).toBe(true);
    expect(z?.exempt).toBe(false);
  });
});
