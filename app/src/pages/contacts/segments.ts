// Pure segment-rule builder helpers (J11, DEC-026/DEC-149). Segments are
// stored as { name, rules: SegmentRule[] } (segment.rules_json). These
// helpers turn the currently active filters (free-text q + the
// FilterRulesPanel's explicit rules) into SegmentRule[] for "save as
// segment" (non-lossy: the exact active rule set is what gets persisted),
// and apply rules client-side for the merge-field / preview count hint
// shown before hitting the server (server-side matchesSegment in
// src/domain/contacts.ts is the actual filter authority for GET /contacts).

import type { ContactListItem, SegmentRule } from './types';

export interface ActiveFilters {
  q: string;
  rules: SegmentRule[];
}

/**
 * Builds SegmentRule[] from the currently active filters: free-text q
 * becomes { field: 'any', op: 'contains', value: q } (DEC-149 — 'any' fans
 * out across email/firstName/lastName/company/title, replacing the old
 * firstName-only approximation), followed by the explicit rules from
 * FilterRulesPanel, unchanged. This is non-lossy: saving a segment from the
 * active filters and reopening it reproduces the exact same result set.
 */
export function buildSegmentRulesFromFilters(filters: ActiveFilters): SegmentRule[] {
  const rules: SegmentRule[] = [];
  const q = filters.q.trim();

  if (q !== '') {
    rules.push({ field: 'any', op: 'contains', value: q });
  }
  rules.push(...filters.rules);

  return rules;
}

const ANY_FIELDS = ['email', 'firstName', 'lastName', 'company', 'title'] as const;

function fieldValue(contact: ContactListItem, field: string): string {
  const value = (contact as unknown as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
}

function matchesRule(rule: SegmentRule, contact: ContactListItem): boolean {
  const expected = rule.value.toLowerCase();

  if (rule.field === 'any') {
    const values = ANY_FIELDS.map((f) => fieldValue(contact, f).toLowerCase());
    switch (rule.op) {
      case 'eq':
        return values.some((v) => v === expected);
      case 'contains':
        return values.some((v) => v.includes(expected));
      case 'ne':
        return values.every((v) => v !== expected);
      default:
        throw new Error(`matchesRules: unknown op "${rule.op}"`);
    }
  }

  const actual = fieldValue(contact, rule.field).toLowerCase();
  switch (rule.op) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'contains':
      return actual.includes(expected);
    default:
      throw new Error(`matchesRules: unknown op "${rule.op}"`);
  }
}

/**
 * Client-side rule evaluation for local preview counts (e.g. showing "N
 * contacts" while building a segment before saving). AND semantics,
 * case-insensitive — mirrors src/domain/contacts.ts's matchesSegment,
 * including the 'any' pseudo-field (DEC-149).
 */
export function matchesRules(rules: SegmentRule[], contact: ContactListItem): boolean {
  return rules.every((rule) => matchesRule(rule, contact));
}

/** Human-readable summary of a rule set, for the segments list ("any contains 'a' AND company = 'Acme'"). */
export function describeRules(rules: SegmentRule[]): string {
  if (rules.length === 0) return '(matches everything)';
  const opLabel: Record<SegmentRule['op'], string> = { eq: '=', ne: '≠', contains: 'contains' };
  return rules.map((r) => `${r.field} ${opLabel[r.op]} "${r.value}"`).join(' AND ');
}
