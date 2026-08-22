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

/**
 * Length-preserving comment blanking, used ONLY to drive `mediaBlockSpans`'s
 * scan below -- every returned `condition`/`body` string and every returned
 * offset is still sliced out of the CALLER's original `css`, so nothing
 * downstream (extractRules' `EXEMPT_COMMENT_RE` probe of the text preceding
 * a rule, the `index` recorded on every Rule) sees a blanked character or a
 * shifted offset.
 *
 * Two distinct hazards, both real in this repo, both fixed by blanking:
 *
 *  1. A literal `@media` sitting in COMMENT PROSE (contacts.css:622 and
 *     styles.css both do this, describing the sheet's own block layout)
 *     otherwise starts a match, so the captured `condition` becomes an
 *     18-line comment with the real `(max-width: 700px)` glued on the end.
 *     styles.css only ever parsed correctly by accident -- `isPhoneCondition`
 *     found a `max-width: 700px` substring buried in the prose.
 *  2. Braces inside comments desynchronise brace counting. `population.ts`'s
 *     `sanitizeCommentBraces` already neutralises those, but it is applied
 *     by CALLERS and not by every one of them (the fixtures below call
 *     `mediaSpans` on raw text), so the scan must not depend on it having
 *     run. Blanking whole comments subsumes it.
 *
 * `\n` is preserved so any line-based diagnostics keep their line numbers.
 */
function blankComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

export interface MediaBlock {
  condition: string;
  body: string;
  start: number; // offset of the `@` of `@media` in the ORIGINAL css
  end: number; // offset one past the block's matching `}`
}

/**
 * Every TOP-LEVEL `@media (...) { ... }` block, located by brace BALANCE.
 *
 * Replaces the flat `@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}` that
 * both `phoneMediaBlocks` and `mediaSpans` used to carry. That pattern could
 * only describe brace nesting exactly ONE level deep, and it was ambiguous:
 * the `[^{}]*` runs on either side of each rule boundary give a failed
 * attempt an exponential number of ways to split the same text. Once
 * `contacts.css` grew a third level -- three `@media (hover: hover)` blocks
 * (:1777, :1803, :1913) nested inside its single DEC-385 terminal
 * `<=700px` block (:637-:1996) -- no match starting at that block was
 * POSSIBLE, so the engine backtracked over every split of ~350 rule gaps and
 * a single `exec` call never returned. That is a 100%-CPU spin that hangs
 * the whole vitest worker, taking `frame-citation.scan.test.ts` and
 * `submissions-table-columns.render.test.tsx` down with it and suppressing
 * the run summary entirely.
 *
 * The CSS is not at fault: DEC-385 requires phone overrides to live inside
 * the sheet's one terminal `<=700px` block, so nesting a capability query
 * in there is the only legal place to put it. The instrument was.
 *
 * Nested at-rules are skipped rather than reported: `lastIndex` jumps past
 * the whole balanced block, so a rule inside `@media (hover: hover)` inside
 * the terminal phone block resolves (via `extractRules`' containment
 * lookup) to the OUTER phone block, which is the span whose condition
 * governs whether it applies at the 390 frame. This mirrors the
 * already-correct scanner in `phone-capability-removal.scan.test.ts`.
 */
export function mediaBlockSpans(css: string): MediaBlock[] {
  const scan = blankComments(css);
  const out: MediaBlock[] = [];
  const openRe = /@media([^{]*)\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(scan)) !== null) {
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < scan.length && depth > 0; i++) {
      const ch = scan[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth !== 0) {
      // Unbalanced input. Fail loudly rather than silently reporting a block
      // that runs to EOF -- a truncated span would mis-scope every rule
      // after it and the resulting offender list would be quietly wrong.
      throw new Error(
        `unbalanced braces in @media block opened at offset ${m.index}: reached end of input at depth ${depth}`,
      );
    }
    out.push({
      // Sliced out of the ORIGINAL css, never the blanked copy.
      condition: css.slice(m.index + '@media'.length, bodyStart - 1).trim(),
      body: css.slice(bodyStart, i - 1),
      start: m.index,
      end: i,
    });
    openRe.lastIndex = i;
  }
  return out;
}

export function phoneMediaBlocks(css: string): Array<{ condition: string; body: string }> {
  return mediaBlockSpans(css).map(({ condition, body }) => ({ condition, body }));
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
  return mediaBlockSpans(css).map(({ start, end, condition }) => ({ start, end, isPhone: appliesAt390(condition) }));
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
