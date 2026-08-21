// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): cascade-aware candidacy
// (DEC-989 wave-119 amendment).
//
// THE HOLE this repairs: the old candidacy test dropped a top-level rule
// from the population the instant ANY phone-scoped rule in the file named
// the same selector token, whether or not that override touched the
// flagged property (app/src/pages/settings/settings.css
// `.chq-settings-row-hint`'s top-level `white-space: nowrap` was never
// checked because a wholly unrelated
// terminal phone rule at settings.css:1600 happened to declare only
// `align-self: flex-end` for the same selector). The repair: every
// top-level rule is ALWAYS a candidate, but it is checked against its
// EFFECTIVE declaration map -- its own top-level declarations, overridden
// property-by-property (last-wins, file order) by every phone-scoped rule
// whose comma-split selector tokens intersect its own -- not its raw body.
// A phone rule that overrides an unrelated property no longer hides a real
// offender; a phone rule that actually overrides the flagged property still
// clears it, exactly as before.
//
// DEC-991 (wave-149 amendment): `rule.isPhoneScoped` (consumed below by both
// `isCandidateRule` and `effectiveBodyFor`) is now computed by
// `appliesAt390`, not `isPhoneCondition` -- see ./rules.ts's `mediaSpans`,
// the single point where that widening happens. A rule inside
// `@media (max-width: 900px)` genuinely applies at the 390 phone frame and
// is therefore now a real phone-scoped override for candidacy and cascade
// purposes here, even though it is not the sheet's DEC-385 terminal
// `<=700px` block. Neither function in this file changed shape -- the
// widening lives entirely in what `isPhoneScoped` already means by the time
// a `Rule` reaches this module.
import type { Rule } from './rules';

/** Ordered `[property, value]` pairs parsed out of a declaration body. */
export function parseDeclarations(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /(-{0,2}[a-zA-Z][a-zA-Z-]*)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push([(m[1] ?? '').trim(), (m[2] ?? '').trim()]);
  }
  return out;
}

/**
 * The effective declaration body for a TOP-LEVEL rule: its own declarations,
 * then every phone-scoped rule's declarations in the same file whose
 * comma-split selector tokens intersect this rule's own tokens, applied in
 * source order, last value wins per property.
 */
export function effectiveBodyFor(rule: Rule, fileRules: Rule[]): string {
  const tokens = new Set(rule.selector.split(',').map((s) => s.trim()));
  const merged = new Map<string, string>();
  for (const [prop, val] of parseDeclarations(rule.body)) merged.set(prop, val);
  for (const r of fileRules) {
    if (!r.isPhoneScoped) continue;
    const rTokens = r.selector.split(',').map((s) => s.trim());
    if (!rTokens.some((t) => tokens.has(t))) continue;
    for (const [prop, val] of parseDeclarations(r.body)) merged.set(prop, val);
  }
  return [...merged.entries()].map(([prop, val]) => `${prop}: ${val};`).join(' ');
}

/**
 * True for every phone-scoped rule and every top-level rule (DEC-989
 * wave-119 predicate repair): a top-level rule is never dropped from the
 * population by another rule's unrelated override -- see the module header.
 */
export function isCandidateRule(rule: Rule): boolean {
  return rule.isPhoneScoped || rule.isTopLevel;
}

/** The body a candidate rule should actually be checked against: cascade-merged for a top-level rule, raw otherwise. */
export function effectiveRuleFor(rule: Rule, fileRules: Rule[]): Rule {
  return rule.isTopLevel && !rule.isPhoneScoped ? { ...rule, body: effectiveBodyFor(rule, fileRules) } : rule;
}
