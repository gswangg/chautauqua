// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): raw-text rule/media-span
// extraction shared by the budget derivation and the shape-check assembly.

import { PHONE_FRAME_WIDTH_PX } from './budget';

export function isPhoneCondition(condition: string): boolean {
  const m = condition.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
  return m !== null && Number(m[1]) <= 700;
}

/**
 * DEC-991 (wave-149 amendment): true when `condition` genuinely APPLIES at
 * the v12 phone frame width (390px) -- a strictly wider question than
 * `isPhoneCondition`'s "did this block author its rules as the sheet's one
 * DEC-385 terminal phone block" (which only ever looks for <=700px). A rule
 * inside `@media (max-width: 900px)` applies at 390 just as surely as one
 * inside `@media (max-width: 700px)` -- a browser rendering the v12 390
 * frame runs BOTH -- yet `isPhoneCondition` said no for the wider block,
 * dropping it from the overflow scan's population entirely (measured: ten
 * such blocks exist in this repo) and hiding real cascade overrides from
 * `effectiveBodyFor`'s merge (agenda.css's 900px block collapsing
 * `.chq-agenda-layout` to `1fr` was invisible to the merge, which kept the
 * desktop `1fr 268px` tracks and could have manufactured a phantom
 * offender).
 *
 * `isPhoneCondition` STAYS, unchanged and separately named: DEC-385's
 * one-terminal-phone-block rule is a contract about WHERE in a sheet a
 * phone override may be AUTHORED (must land in the sheet's single
 * `<=700px` block), not about what a browser applies at a given width.
 * Those are two different questions and must never share one predicate --
 * conflating them would let a legitimate `<=900px` breakpoint block get
 * flagged as a DEC-385 violation, or let this scan's population silently
 * shrink back to "authored as phone" the day someone "simplifies" the
 * duplicate-looking check.
 *
 * True when `condition` declares a `max-width: X` with X >= 390 (the block
 * reaches down to or past the 390 frame) AND does not also declare a
 * `min-width: Y` with Y > 390 (which would exclude 390 from the block's own
 * range, e.g. `(min-width: 700px) and (max-width: 900px)`).
 */
export function appliesAt390(condition: string): boolean {
  const maxWidths = [...condition.matchAll(/max-width:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  if (!maxWidths.some((x) => x >= PHONE_FRAME_WIDTH_PX)) return false;
  const minWidths = [...condition.matchAll(/min-width:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  return !minWidths.some((y) => y > PHONE_FRAME_WIDTH_PX);
}

export function phoneMediaBlocks(css: string): Array<{ condition: string; body: string }> {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  const out: Array<{ condition: string; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ condition: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return out;
}

export function ruleBodyIn(fragment: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = fragment.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  const body = m?.[1];
  if (body === undefined) throw new Error(`no rule found for ${selector} in the given fragment`);
  return body;
}

export interface Rule {
  selector: string;
  body: string; // declarations, comments stripped -- a comment sitting between two declarations is not a `;` boundary, and every check below anchors on one
  index: number;
  isPhoneScoped: boolean; // DEC-991 wave-149: driven by appliesAt390 (mediaSpans below), not isPhoneCondition -- "applies at the 390 frame", not "authored as the sheet's DEC-385 terminal phone block"
  isTopLevel: boolean; // not nested in ANY @media block
  isExempt: boolean; // an inline overflow-exempt comment sits directly above this rule
}

export const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
export const EXEMPT_COMMENT_RE = /\/\*\s*overflow-exempt:\s*[^*]*\*\//;

/**
 * `isPhone` here means "applies at the 390 frame" (DEC-991 wave-149:
 * `appliesAt390`), NOT "is the sheet's DEC-385 terminal phone block"
 * (`isPhoneCondition`) -- this is the single point where that widened
 * candidacy question feeds `Rule.isPhoneScoped`, and through it both
 * `isCandidateRule` and `effectiveBodyFor`'s cascade merge in ./cascade.ts.
 */
export function mediaSpans(css: string): Array<{ start: number; end: number; isPhone: boolean }> {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  const out: Array<{ start: number; end: number; isPhone: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, isPhone: appliesAt390((m[1] ?? '').trim()) });
  }
  return out;
}

/**
 * Every innermost `selector { body }` rule in raw text, in source order,
 * with position info. Because the leading `@media (...) {` text can never
 * itself satisfy `[^{}]+\{[^{}]*\}` (its own body contains a nested `{`),
 * every attempt that starts inside a media header fails outright and the
 * engine's next attempt lands on the inner rule -- so this single flat
 * pattern finds every innermost rule directly in the RAW (unstripped)
 * text, media or no media, with real character offsets. Because there is
 * no such forcing failure between two ordinary rules, the captured
 * "selector" text for a normal rule starts right after the PREVIOUS rule's
 * closing `}` and so includes any comments/whitespace sitting between them
 * -- comments are stripped out to get the real selector, and checked for
 * the overflow-exempt marker before being discarded.
 */
export function extractRules(css: string, spans: Array<{ start: number; end: number; isPhone: boolean }>): Rule[] {
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const rawPre = m[1] ?? '';
    const isExempt = EXEMPT_COMMENT_RE.test(rawPre);
    const selector = rawPre.replace(COMMENT_RE, ' ').trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue; // @keyframes/@font-face/@supports headers etc.
    const body = (m[2] ?? '').replace(COMMENT_RE, ' ');
    const span = spans.find((s) => m!.index >= s.start && m!.index < s.end);
    rules.push({
      selector,
      body,
      index: m.index,
      isPhoneScoped: span?.isPhone ?? false,
      isTopLevel: span === undefined,
      isExempt,
    });
  }
  return rules;
}
