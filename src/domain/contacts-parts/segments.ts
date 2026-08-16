// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only.
//
// Part of the contacts.ts decomposition (structure custodian): free-text
// search tokenization and segment-rule matching. src/domain/contacts.ts
// re-exports everything here; import from that barrel, not this file,
// outside of the contacts-parts/* sibling modules themselves.

import type { ContactRecord } from "./types";

// DEC-422 (amendment, wave 59): batch caps get one pure-core home so a
// route module can never hand-declare its own `const MAX_* = <number>`
// literal (see test/batch-cap-declaration.scan.test.ts). Bounds the
// segment rule set on BOTH the write path (POST/PATCH /segments) and the
// read path (?rules=), so a stored segment can never exceed what a live
// query is allowed to send -- same constant, one spelling (DEC-417,
// wave-31 amendment).
export const MAX_SEGMENT_RULES = 20;

/**
 * Splits a free-text contact search query into lowercase, whitespace-
 * separated tokens (DEC-266). Empty/whitespace-only input yields [] (the
 * caller treats zero tokens as "match everything").
 */
export function tokenizeContactQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t !== "");
}

export interface SegmentRule {
  field: string;
  op: "eq" | "ne" | "contains";
  value: string;
}

// DEC-554: exported so the segment/rules whole-directory scan (crud.ts)
// can derive its SQL projection by enumeration instead of hand-listing.
export const SEGMENT_STANDARD_FIELDS = new Set(["email", "firstName", "lastName", "company", "title"]);

function fieldValue(contact: ContactRecord, field: string): string {
  if (field.startsWith("custom.")) {
    const key = field.slice("custom.".length);
    return contact.customFields?.[key] ?? "";
  }
  if (!SEGMENT_STANDARD_FIELDS.has(field)) {
    throw new Error(`matchesSegment: unknown field "${field}"`);
  }
  const value = (contact as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

/** The standard fields 'any' fans out across (DEC-149) — custom.<key> fields
 * are intentionally excluded from 'any', matching the free-text search box's
 * historical scope of name/email/company/title. */
const ANY_FIELDS = ["email", "firstName", "lastName", "company", "title"] as const;

function matchesRule(rule: SegmentRule, contact: ContactRecord): boolean {
  const expected = rule.value.toLowerCase();

  if (rule.field === "any") {
    const values = ANY_FIELDS.map((f) => fieldValue(contact, f).toLowerCase());
    switch (rule.op) {
      case "eq":
        return values.some((v) => v === expected);
      case "contains":
        return values.some((v) => v.includes(expected));
      case "ne":
        return values.every((v) => v !== expected);
      default:
        throw new Error(`matchesSegment: unknown op "${rule.op}"`);
    }
  }

  const actual = fieldValue(contact, rule.field).toLowerCase();
  switch (rule.op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
    default:
      throw new Error(`matchesSegment: unknown op "${rule.op}"`);
  }
}

const SEGMENT_RULE_OPS = new Set(["eq", "ne", "contains"]);

function isValidSegmentRule(value: unknown): value is SegmentRule {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.field === "string" &&
    typeof v.op === "string" &&
    SEGMENT_RULE_OPS.has(v.op) &&
    typeof v.value === "string"
  );
}

/**
 * Parses and validates a segment's stored rules_json (DEC-026), the same
 * shape the write path (POST/PATCH /segments) already enforces. Fails
 * loudly rather than letting a malformed row reach matchesRule as an
 * unnamed TypeError (e.g. rule.value.toLowerCase() on a non-string) or
 * .every on a non-array.
 */
export function parseSegmentRulesJson(raw: string, segmentId: string): SegmentRule[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`segment ${segmentId}.rules_json: expected an array`);
  }
  if (parsed.length > MAX_SEGMENT_RULES) {
    throw new Error(`segment ${segmentId}.rules_json: exceeds MAX_SEGMENT_RULES (${MAX_SEGMENT_RULES})`);
  }
  if (!parsed.every(isValidSegmentRule)) {
    throw new Error(`segment ${segmentId}.rules_json: rule does not match { field: string, op: 'eq'|'ne'|'contains', value: string }`);
  }
  return parsed;
}

/**
 * AND semantics across all rules, case-insensitive comparisons. Custom
 * fields are addressable as 'custom.<key>'. field === 'any' (DEC-149)
 * evaluates against email/firstName/lastName/company/title: a rule matches
 * if ANY of those fields matches for eq/contains, or if ALL of them differ
 * for ne. An unknown standard field name (other than 'any') throws (fail
 * loudly) — this module never silently treats unrecognized fields as empty.
 */
export function matchesSegment(rules: SegmentRule[], contact: ContactRecord): boolean {
  return rules.every((rule) => matchesRule(rule, contact));
}
