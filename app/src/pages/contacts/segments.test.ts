import { describe, expect, it } from 'vitest';
import { buildSegmentRulesFromFilters, describeRules, matchesRules } from './segments';
import type { ContactListItem, SegmentRule } from './types';

const contact: ContactListItem = { id: 'c1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme' };

describe('buildSegmentRulesFromFilters', () => {
  it('returns [] when no filters are active', () => {
    expect(buildSegmentRulesFromFilters({ q: '', company: '' })).toEqual([]);
  });

  it('builds a contains rule for q and an eq rule for company', () => {
    const rules = buildSegmentRulesFromFilters({ q: 'ada', company: 'Acme' });
    expect(rules).toEqual([
      { field: 'firstName', op: 'contains', value: 'ada' },
      { field: 'company', op: 'eq', value: 'Acme' },
    ]);
  });

  it('trims whitespace-only filters to nothing', () => {
    expect(buildSegmentRulesFromFilters({ q: '   ', company: '  ' })).toEqual([]);
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
});

describe('describeRules', () => {
  it('describes an empty rule set', () => {
    expect(describeRules([])).toBe('(matches everything)');
  });

  it('joins rules with AND', () => {
    const rules: SegmentRule[] = [
      { field: 'firstName', op: 'contains', value: 'ada' },
      { field: 'company', op: 'ne', value: 'Acme' },
    ];
    expect(describeRules(rules)).toBe('firstName contains "ada" AND company ≠ "Acme"');
  });
});
