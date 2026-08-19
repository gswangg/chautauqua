// DEC-393 wave-106 (task w2-d): settles docs/design/audit/phone-tap-floor-links.md:102's
// open call by splitting `chq-overview-link-btn` (a row-action tap-target
// control) from `chq-overview-link-inline` (a URL sitting inside running
// prose, which must never carry the 44px control floor -- flooring it would
// break the line box). This test reads the actual source files rather than
// trusting a description, and strips CSS comments before walking braces
// because overview.css's own provenance comments quote CSS literals
// (`@media`, brace pairs, selector text) that would desync a naive scanner.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const overviewTsxPath = path.join(here, '..', 'Overview.tsx');
const overviewCssPath = path.join(here, 'overview.css');

const overviewTsx = readFileSync(overviewTsxPath, 'utf8');
const overviewCssRaw = readFileSync(overviewCssPath, 'utf8');

/** Strip /* ... *\/ CSS comments (non-greedy, dotall) before any brace walk. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

interface CssRule {
  selector: string;
  body: string;
  mediaStack: string[];
}

/**
 * Depth-counting reader: walks the (comment-stripped) stylesheet character
 * by character. Tracks @media nesting via an explicit context stack (popped
 * on that context's matching close brace) rather than regex splitting on
 * commas/braces, which the file's own provenance comments quoting CSS
 * literals would desynchronise if comments weren't stripped first.
 */
function parseRules(css: string): CssRule[] {
  const clean = stripCssComments(css);
  const rules: CssRule[] = [];
  const n = clean.length;
  let i = 0;
  const mediaStack: string[] = [];
  // stack of markers: 'media' pushed when we open an @media body, popped
  // when that body's closing brace is consumed.
  const kindStack: Array<'media' | 'other'> = [];

  function readBalanced(startIdx: number): number {
    // startIdx points just after the opening '{'; returns index of the
    // matching '}' (not consumed).
    let depth = 1;
    let p = startIdx;
    while (p < n && depth > 0) {
      if (clean.charAt(p) === '{') depth++;
      else if (clean.charAt(p) === '}') {
        depth--;
        if (depth === 0) return p;
      }
      p++;
    }
    return p;
  }

  while (i < n) {
    if (/\s/.test(clean.charAt(i))) {
      i++;
      continue;
    }
    if (clean.charAt(i) === '}') {
      // Closing an @media (or stray) context
      if (kindStack.length > 0) {
        const kind = kindStack.pop();
        if (kind === 'media') mediaStack.pop();
      }
      i++;
      continue;
    }
    // Read up to the next '{' or ';' to determine what construct this is
    let j = i;
    while (j < n && clean.charAt(j) !== '{' && clean.charAt(j) !== ';') j++;
    if (j >= n) break;
    if (clean.charAt(j) === ';') {
      i = j + 1;
      continue;
    }
    const prelude = clean.slice(i, j).trim();
    if (prelude.startsWith('@media')) {
      mediaStack.push(prelude);
      kindStack.push('media');
      i = j + 1;
      continue;
    }
    if (prelude.startsWith('@')) {
      // other at-rule with a body (e.g. @font-face, @keyframes) -- treat
      // its body as opaque, not a rule set we care about, and don't push
      // to mediaStack.
      const close = readBalanced(j + 1);
      kindStack.push('other');
      i = close; // will hit '}' handling next loop, popping 'other'
      continue;
    }
    // Plain rule
    const close = readBalanced(j + 1);
    const body = clean.slice(j + 1, close);
    rules.push({ selector: prelude, body, mediaStack: [...mediaStack] });
    i = close; // will hit the '}' handling next loop iteration
  }
  return rules;
}

const rules = parseRules(overviewCssRaw);

describe('overview link register (DEC-393 wave-106, task w2-d)', () => {
  it('Overview.tsx uses chq-overview-link-inline exactly once, on the /e/ public-link anchor', () => {
    const occurrences = overviewTsx.split('chq-overview-link-inline').length - 1;
    expect(occurrences).toBe(1);

    const idx = overviewTsx.indexOf('chq-overview-link-inline');
    expect(idx).toBeGreaterThan(-1);
    // The anchor carrying this class must be the /e/${eventSlug} public link.
    const windowStart = Math.max(0, idx - 400);
    const surrounding = overviewTsx.slice(windowStart, idx + 100);
    expect(surrounding).toContain('/e/${eventSlug}');
    expect(surrounding).toContain('<a href=');
  });

  it('chq-overview-link-btn (four row-action call sites) is untouched by the inline split', () => {
    const btnOccurrences = overviewTsx.split('chq-overview-link-btn').length - 1;
    // chq-overview-link-btn also appears as a substring in
    // chq-overview-link-btn-read and chq-overview-link-muted usages; just
    // assert the base token still appears at least 4 times (the four
    // preserved row-action sites) and chq-overview-link-inline never
    // collides with (is not a substring match inflating) that count.
    expect(btnOccurrences).toBeGreaterThanOrEqual(4);
  });

  it('.chq-overview-link-inline has a top-level rule (no @media) that declares no min-height', () => {
    const topLevel = rules.filter(
      (r) => r.mediaStack.length === 0 && r.selector.split(',').some((s) => s.trim() === '.chq-overview-link-inline'),
    );
    expect(topLevel.length).toBeGreaterThanOrEqual(1);
    for (const rule of topLevel) {
      expect(rule.body).not.toMatch(/min-height\s*:/);
      expect(rule.body).not.toMatch(/display\s*:\s*flex/);
      expect(rule.body).not.toMatch(/display\s*:\s*inline-flex/);
    }
  });

  it('.chq-overview-link-btn reaches the 44px floor inside a max-width:700px block', () => {
    const phoneFloored = rules.filter(
      (r) =>
        r.mediaStack.some((m) => /max-width\s*:\s*700px/.test(m)) &&
        r.selector.split(',').some((s) => s.trim() === '.chq-overview-link-btn'),
    );
    expect(phoneFloored.length).toBeGreaterThanOrEqual(1);

    const hasFloor = phoneFloored.some((rule) => {
      const hasMinHeight44 = /min-height\s*:\s*44px/.test(rule.body);
      const hasFlex = /display\s*:\s*(flex|inline-flex)/.test(rule.body);
      const hasAlignCenter = /align-items\s*:\s*center/.test(rule.body);
      const hasHorizontalPadding =
        /padding-inline\s*:\s*(?!0\b)[^;]+/.test(rule.body) ||
        /padding-(left|right)\s*:\s*(?!0\b)[^;]+/.test(rule.body) ||
        /padding\s*:\s*[^;]*\s[1-9][^;]*/.test(rule.body);
      return hasMinHeight44 && hasFlex && hasAlignCenter && hasHorizontalPadding;
    });
    expect(hasFloor).toBe(true);
  });
});
