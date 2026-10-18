// Multi-portal rules: an OR of AND groups over participation fields
// (Portals frame, flow 2 "Match participations where"). Pure core.

import type { Participation } from "./participations";

export const RULE_FIELDS = [
  "kind",
  "role",
  "arrival",
  "format",
  "track",
  "session_status",
  "participation_status",
  "sponsor_tier",
  "sponsorship_status",
] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

// A contact custom field is addressed as "custom:<key>".
export const CUSTOM_FIELD_PREFIX = "custom:";

export const RULE_FIELD_LABELS: Record<RuleField, string> = {
  kind: "Participation",
  role: "Role",
  arrival: "How the session arrived",
  format: "Session format",
  track: "Track",
  session_status: "Session status",
  participation_status: "Participation status",
  sponsor_tier: "Sponsor tier",
  sponsorship_status: "Sponsorship status",
};

export const RULE_OPS = ["is", "is_not", "is_any_of", "is_none_of", "is_empty", "is_not_empty"] as const;
export type RuleOp = (typeof RULE_OPS)[number];

export const RULE_OP_LABELS: Record<RuleOp, string> = {
  is: "is",
  is_not: "is not",
  is_any_of: "is any of",
  is_none_of: "is none of",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

export const VALUELESS_OPS: readonly RuleOp[] = ["is_empty", "is_not_empty"];

export interface RuleCondition {
  field: string;
  op: RuleOp;
  values: string[];
}

export interface RuleGroup {
  conditions: RuleCondition[];
}

export interface PortalRule {
  groups: RuleGroup[];
}

export const MAX_RULE_GROUPS = 10;
export const MAX_RULE_CONDITIONS = 20;
export const MAX_RULE_VALUES = 50;

export const EMPTY_RULE: PortalRule = { groups: [] };

export function isRuleField(field: string): boolean {
  return (RULE_FIELDS as readonly string[]).includes(field) || isCustomField(field);
}

export function isCustomField(field: string): boolean {
  return field.startsWith(CUSTOM_FIELD_PREFIX) && field.length > CUSTOM_FIELD_PREFIX.length;
}

function isRuleOp(op: unknown): op is RuleOp {
  return typeof op === "string" && (RULE_OPS as readonly string[]).includes(op);
}

/** Validates an untrusted rule (a request body or a stored column). Throws
 * with a sentence naming the first problem. */
export function parsePortalRule(input: unknown): PortalRule {
  if (typeof input !== "object" || input === null || !Array.isArray((input as { groups?: unknown }).groups)) {
    throw new Error("A rule needs a list of groups.");
  }
  const groups = (input as { groups: unknown[] }).groups;
  if (groups.length > MAX_RULE_GROUPS) throw new Error(`A rule can have at most ${MAX_RULE_GROUPS} "or" groups.`);
  return {
    groups: groups.map((g) => {
      if (typeof g !== "object" || g === null || !Array.isArray((g as { conditions?: unknown }).conditions)) {
        throw new Error("Each group needs a list of conditions.");
      }
      const conditions = (g as { conditions: unknown[] }).conditions;
      if (conditions.length > MAX_RULE_CONDITIONS) {
        throw new Error(`A group can have at most ${MAX_RULE_CONDITIONS} conditions.`);
      }
      return {
        conditions: conditions.map((c) => {
          if (typeof c !== "object" || c === null) throw new Error("Each condition needs a field, a test and values.");
          const { field, op, values } = c as { field?: unknown; op?: unknown; values?: unknown };
          if (typeof field !== "string" || !isRuleField(field)) throw new Error(`Unknown rule field: ${String(field)}.`);
          if (!isRuleOp(op)) throw new Error(`Unknown rule test: ${String(op)}.`);
          const list = values === undefined ? [] : values;
          if (!Array.isArray(list) || list.some((v) => typeof v !== "string")) {
            throw new Error("Condition values must be a list of strings.");
          }
          if (list.length > MAX_RULE_VALUES) throw new Error(`A condition can list at most ${MAX_RULE_VALUES} values.`);
          if (!VALUELESS_OPS.includes(op) && list.length === 0) {
            throw new Error(`"${RULE_OP_LABELS[op]}" needs at least one value.`);
          }
          return { field, op, values: VALUELESS_OPS.includes(op) ? [] : (list as string[]) };
        }),
      };
    }),
  };
}

export function parsePortalRuleJson(json: string): PortalRule {
  return parsePortalRule(JSON.parse(json));
}

/** The participation's values for one field: a field can hold several
 * values (a session on two tracks), and an empty list means "no value". */
export function fieldValues(p: Participation, field: string): string[] {
  if (isCustomField(field)) {
    const value = p.customFields[field.slice(CUSTOM_FIELD_PREFIX.length)];
    return value === undefined || value === "" ? [] : [value];
  }
  switch (field as RuleField) {
    case "kind":
      return [p.kind];
    case "role":
      return [p.role];
    case "arrival":
      return p.session ? [p.session.origin] : [];
    case "format":
      return p.session?.format ? [p.session.format] : [];
    case "track":
      return p.session ? p.session.trackIds : [];
    case "session_status":
      return p.session ? [p.session.status] : [];
    case "participation_status":
      return [p.participationStatus];
    case "sponsor_tier":
      return p.company?.tierId ? [p.company.tierId] : [];
    case "sponsorship_status":
      return p.company ? [p.company.sponsorshipStatus] : [];
  }
  throw new Error(`Unknown rule field: ${field}`);
}

function sameValue(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function matchesCondition(p: Participation, c: RuleCondition): boolean {
  const have = fieldValues(p, c.field);
  const hit = have.some((h) => c.values.some((v) => sameValue(h, v)));
  switch (c.op) {
    case "is":
    case "is_any_of":
      return hit;
    case "is_not":
    case "is_none_of":
      return !hit;
    case "is_empty":
      return have.length === 0;
    case "is_not_empty":
      return have.length > 0;
  }
}

/** A participation matches when every condition of at least one group
 * holds. A rule with no groups, or a group with no conditions, matches
 * nobody: an empty rule is a portal still being set up. */
export function matchesRule(rule: PortalRule, p: Participation): boolean {
  return rule.groups.some((g) => g.conditions.length > 0 && g.conditions.every((c) => matchesCondition(p, c)));
}

export interface RuleLabels {
  field: (field: string) => string;
  value: (field: string, value: string) => string;
}

function joinWords(words: string[], last: string): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${last} ${words[words.length - 1]}`;
}

/** Plain-language summary for the overview and the Settings section:
 * "Role is Speaker or Moderator and How the session arrived is Invited by
 * organizers, or Session format is Keynote". */
export function describeRule(rule: PortalRule, labels: RuleLabels): string {
  const groups = rule.groups.filter((g) => g.conditions.length > 0);
  if (groups.length === 0) return "Nobody yet: the rule has no conditions";
  return groups
    .map((g) =>
      g.conditions
        .map((c) => {
          const field = labels.field(c.field);
          if (VALUELESS_OPS.includes(c.op)) return `${field} ${RULE_OP_LABELS[c.op]}`;
          const values = c.values.map((v) => labels.value(c.field, v));
          const negative = c.op === "is_not" || c.op === "is_none_of";
          return `${field} ${negative ? "is not" : "is"} ${joinWords(values, negative ? "nor" : "or")}`;
        })
        .join(" and "),
    )
    .join(", or ");
}
