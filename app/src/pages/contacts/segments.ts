// Pure segment-rule builder helpers (J11, DEC-026). Segments are stored as
// { name, rules: SegmentRule[] } (segment.rules_json). These helpers turn
// the active table filters (q + company) into SegmentRule[] for "save as
// segment", and apply rules client-side for the merge-field / preview count
// hint shown before hitting the server (server-side matchesSegment in
// src/domain/contacts.ts is the actual filter authority for GET /contacts).

import type { ContactListItem, SegmentRule } from './types';

export interface ActiveFilters {
  q: string;
  company: string;
}

/**
 * Builds SegmentRule[] from the currently active q/company filters. `q`
 * becomes a 'contains' rule against firstName (the segment-rule model has no
 * "any field" operator, so free-text search is approximated on name — the
 * organizer can edit rules after saving); company becomes an 'eq' rule.
 * Blank filters contribute no rule. Returns [] if nothing is active.
 */
export function buildSegmentRulesFromFilters(filters: ActiveFilters): SegmentRule[] {
  const rules: SegmentRule[] = [];
  const q = filters.q.trim();
  const company = filters.company.trim();

  if (q !== '') {
    rules.push({ field: 'firstName', op: 'contains', value: q });
  }
  if (company !== '') {
    rules.push({ field: 'company', op: 'eq', value: company });
  }
  return rules;
}

function fieldValue(contact: ContactListItem, field: string): string {
  const value = (contact as unknown as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
}

/**
 * Client-side rule evaluation for local preview counts (e.g. showing "N
 * contacts" while building a segment before saving). AND semantics,
 * case-insensitive — mirrors src/domain/contacts.ts's matchesSegment for the
 * standard-field subset the SPA can construct rules for.
 */
export function matchesRules(rules: SegmentRule[], contact: ContactListItem): boolean {
  return rules.every((rule) => {
    const actual = fieldValue(contact, rule.field).toLowerCase();
    const expected = rule.value.toLowerCase();
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
  });
}

/** Human-readable summary of a rule set, for the segments list ("firstName contains 'a' AND company = 'Acme'"). */
export function describeRules(rules: SegmentRule[]): string {
  if (rules.length === 0) return '(matches everything)';
  const opLabel: Record<SegmentRule['op'], string> = { eq: '=', ne: '≠', contains: 'contains' };
  return rules.map((r) => `${r.field} ${opLabel[r.op]} "${r.value}"`).join(' AND ');
}
