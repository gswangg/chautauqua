import { describe, expect, it } from 'vitest';
import { activeRules, buildSegmentRulesFromFilters, describeRules, matchesRules } from './segments';
import type { ContactListItem, SegmentRule } from './types';

const contact: ContactListItem = { id: 'c1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] };

describe('buildSegmentRulesFromFilters', () => {
  it('returns [] when no filters are active', () => {
    expect(buildSegmentRulesFromFilters({ q: '', rules: [] })).toEqual([]);
  });

  it('emits q as a field:any contains rule, followed by the explicit rules unchanged', () => {
    const explicitRules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    const rules = buildSegmentRulesFromFilters({ q: 'ada', rules: explicitRules });
    expect(rules).toEqual([
      { field: 'any', op: 'contains', value: 'ada' },
      { field: 'company', op: 'eq', value: 'Acme' },
    ]);
  });

  it('trims a whitespace-only q to nothing, keeping only explicit rules', () => {
    const explicitRules: SegmentRule[] = [{ field: 'title', op: 'ne', value: 'CEO' }];
    expect(buildSegmentRulesFromFilters({ q: '   ', rules: explicitRules })).toEqual(explicitRules);
  });

  it('reproduces the exact active rules with no q (non-lossy segment-from-filter)', () => {
    const explicitRules: SegmentRule[] = [
      { field: 'any', op: 'contains', value: 'acme' },
      { field: 'email', op: 'ne', value: 'test@example.com' },
    ];
    expect(buildSegmentRulesFromFilters({ q: '', rules: explicitRules })).toEqual(explicitRules);
  });
});

describe('matchesRules', () => {
  it('AND semantics, case-insensitive', () => {
    const rules: SegmentRule[] = [
      { field: 'firstName', op: 'contains', value: 'AD' },
      { field: 'company', op: 'eq', value: 'acme' },
    ];
    expect(matchesRules(rules, contact)).toBe(true);
  });

  it('fails when any rule does not match', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'other' }];
    expect(matchesRules(rules, contact)).toBe(false);
  });

  it('empty rules match everything', () => {
    expect(matchesRules([], contact)).toBe(true);
  });

  describe("field: 'any' (DEC-149)", () => {
    it('contains matches if ANY of email/firstName/lastName/company/title matches', () => {
      expect(matchesRules([{ field: 'any', op: 'contains', value: 'acme' }], contact)).toBe(true);
      expect(matchesRules([{ field: 'any', op: 'contains', value: 'lovelace' }], contact)).toBe(true);
      expect(matchesRules([{ field: 'any', op: 'contains', value: 'nope' }], contact)).toBe(false);
    });

    it('eq matches if ANY field equals the value exactly', () => {
      expect(matchesRules([{ field: 'any', op: 'eq', value: 'ada' }], contact)).toBe(true);
      expect(matchesRules([{ field: 'any', op: 'eq', value: 'ada lovelace' }], contact)).toBe(false);
    });

    it('ne matches only if ALL fields differ from the value', () => {
      expect(matchesRules([{ field: 'any', op: 'ne', value: 'nope' }], contact)).toBe(true);
      expect(matchesRules([{ field: 'any', op: 'ne', value: 'acme' }], contact)).toBe(false);
    });
  });
});

describe('activeRules (DEC-868)', () => {
  it('drops a rule with an empty (or whitespace-only) value', () => {
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'contains', value: '' },
      { field: 'email', op: 'contains', value: '   ' },
    ];
    expect(activeRules(rules)).toEqual([{ field: 'company', op: 'eq', value: 'Acme' }]);
  });

  it('drops an unfinished custom field (field exactly "custom.")', () => {
    const rules: SegmentRule[] = [
      { field: 'custom.', op: 'contains', value: 'L' },
      { field: 'custom.tshirt', op: 'contains', value: 'L' },
    ];
    expect(activeRules(rules)).toEqual([{ field: 'custom.tshirt', op: 'contains', value: 'L' }]);
  });

  it('keeps a fully-specified rule set unchanged', () => {
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'custom.role', op: 'eq', value: 'speaker' },
    ];
    expect(activeRules(rules)).toEqual(rules);
  });

  it('empty input yields empty output', () => {
    expect(activeRules([])).toEqual([]);
  });
});

describe('describeRules', () => {
  it('describes an empty rule set', () => {
    expect(describeRules([])).toBe('(matches everything)');
  });

  it('joins rules with AND', () => {
    const rules: SegmentRule[] = [
      { field: 'any', op: 'contains', value: 'ada' },
      { field: 'company', op: 'ne', value: 'Acme' },
    ];
    expect(describeRules(rules)).toBe('any contains "ada" AND company ≠ "Acme"');
  });
});
