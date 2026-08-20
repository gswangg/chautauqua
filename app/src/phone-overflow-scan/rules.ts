// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): raw-text rule/media-span
// extraction shared by the budget derivation and the shape-check assembly.

export function isPhoneCondition(condition: string): boolean {
  const m = condition.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
  return m !== null && Number(m[1]) <= 700;
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
  isPhoneScoped: boolean;
  isTopLevel: boolean; // not nested in ANY @media block
  isExempt: boolean; // an inline overflow-exempt comment sits directly above this rule
}

export const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
export const EXEMPT_COMMENT_RE = /\/\*\s*overflow-exempt:\s*[^*]*\*\//;

export function mediaSpans(css: string): Array<{ start: number; end: number; isPhone: boolean }> {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  const out: Array<{ start: number; end: number; isPhone: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, isPhone: isPhoneCondition((m[1] ?? '').trim()) });
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
