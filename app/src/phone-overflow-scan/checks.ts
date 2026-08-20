// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): the flagged-shape detectors
// (A)-(D) from that file's header comment. `checkWidthProps` and
// `checkGridTemplateColumns` take `budgetPx` explicitly (rather than
// closing over a module-level constant) so this module has no import-order
// dependency on how the caller derives its budget.
import type { Rule } from './rules';

export function checkWidthProps(body: string, budgetPx: number): string[] {
  const hits: string[] = [];
  const re = /(?:^|;)\s*(width|min-width|flex-basis)\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const px = Number(m[2]);
    if (px > budgetPx) hits.push(`${m[1]}: ${px}px exceeds budget ${budgetPx}px`);
  }
  return hits;
}

export function checkGridTemplateColumns(body: string, budgetPx: number): string[] {
  const gtc = body.match(/grid-template-columns\s*:\s*([^;]+);/);
  if (!gtc) return [];
  const tracks = gtc[1]?.match(/\d+(?:\.\d+)?px/g) ?? [];
  if (tracks.length === 0) return [];
  const trackSum = tracks.reduce((sum, t) => sum + Number(t.replace('px', '')), 0);
  const gapMatch = body.match(/(?:^|;)\s*(?:column-)?gap\s*:\s*(\d+(?:\.\d+)?)px/);
  const gapPx = gapMatch ? Number(gapMatch[1]) * Math.max(0, tracks.length - 1) : 0;
  const total = trackSum + gapPx;
  if (total > budgetPx) {
    return [`grid-template-columns fixed tracks ${trackSum}px + gaps ${gapPx}px = ${total}px exceeds budget ${budgetPx}px`];
  }
  return [];
}

export function checkNowrap(body: string): string[] {
  if (!/white-space\s*:\s*nowrap/.test(body)) return [];
  const hasEscape = /(?:overflow(?:-x)?\s*:\s*(?:hidden|auto|scroll))|(?:text-overflow\s*:\s*ellipsis)/.test(body);
  return hasEscape ? [] : ['white-space: nowrap with no overflow/text-overflow escape in the same rule'];
}

export function baseToken(selector: string): string {
  // First comma part, first compound token (drop pseudo-classes/descendant chains).
  return (selector.split(',')[0] ?? '').trim().split(/\s+/)[0]?.split(':')[0] ?? '';
}

export function checkTableLayout(rule: Rule, fileRules: Rule[]): string[] {
  if (!/table-layout\s*:\s*fixed/.test(rule.body)) return [];
  const base = baseToken(rule.selector);
  if (!base) return [];
  const columnSelectors = fileRules.filter(
    (r) => baseToken(r.selector) === base && /:(?:first-child|last-child|nth-child\(\d+\))/.test(r.selector),
  );
  const distinctColumns = new Set(columnSelectors.map((r) => r.selector));
  if (distinctColumns.size <= 2) return [];
  const hasPhoneReflow = fileRules.some(
    (r) =>
      r.isPhoneScoped &&
      baseToken(r.selector) === base &&
      (/display\s*:\s*(?:block|contents)/.test(r.body) || /table-layout\s*:\s*auto/.test(r.body)),
  );
  if (hasPhoneReflow) return [];
  return [
    `table-layout: fixed on ${base} with ${distinctColumns.size} declared columns, no phone reflow (display:block|contents or table-layout:auto) for the same base`,
  ];
}

export function runChecks(rule: Rule, fileRules: Rule[], budgetPx: number): string[] {
  return [
    ...checkWidthProps(rule.body, budgetPx),
    ...checkGridTemplateColumns(rule.body, budgetPx),
    ...checkNowrap(rule.body),
    ...checkTableLayout(rule, fileRules),
  ];
}
