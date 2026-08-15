// DEC-436 wave-25 amendment: MAKE FROZEN AND DESTRUCTIVE REVIEW CONTROLS
// LEGIBLE. task-w17-d-render-sweep.md:97-102 found the review plan editor's
// `label.chq-review-checkbox-label` (frozen anonymize toggle) at 2.43:1 fg
// rgb(142,138,122) on bg rgb(221,216,200), and
// `button.chq-link-button.chq-review-editor-footer-delete` at 3.06:1 while
// disabled. Per DEC-436's flip-to-blocking contrast pass, a genuinely inert
// control (real `disabled`/`aria-disabled` on the element, per DEC-436's
// wave-25 amendment) needs only 3:1; a live/destructive control needs the
// full 4.5:1 normal-text floor. This test parses the real token values out
// of the two token sources (app/src/styles.css and its src/views/theme.ts
// mirror, which DEC-372 keeps byte-for-byte equal) plus the real rule
// bodies out of review.css, and computes the ratio with the existing pure
// `contrastRatio`/`relativeLuminance` helpers from
// scripts/render-sweep-contrast.ts (never re-implementing the WCAG
// formula) so it fails loudly if either pair regresses.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONTRAST_MIN_RATIO, CONTRAST_MIN_RATIO_LARGE, contrastRatio } from '../scripts/render-sweep-contrast';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const STYLES_CSS_PATH = join(REPO_ROOT, 'app', 'src', 'styles.css');
const THEME_TS_PATH = join(REPO_ROOT, 'src', 'views', 'theme.ts');
const REVIEW_CSS_PATH = join(REPO_ROOT, 'app', 'src', 'pages', 'review', 'review.css');

const STYLES_CSS = readFileSync(STYLES_CSS_PATH, 'utf-8');
const THEME_TS = readFileSync(THEME_TS_PATH, 'utf-8');
const REVIEW_CSS_RAW = readFileSync(REVIEW_CSS_PATH, 'utf-8');
const REVIEW_CSS = REVIEW_CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Parse every `--chq-*: #rrggbb;` custom property out of a `:root { ... }`
 * block (styles.css) into a name -> [r,g,b] map. */
function parseRootTokens(css: string): Record<string, [number, number, number]> {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) throw new Error('no :root block found');
  return parseTokenDecls(rootMatch[1]!);
}

/** Parse every `--chq-*: #rrggbb;` custom property out of theme.ts's
 * template-literal `:root { ... }` block into a name -> [r,g,b] map. */
function parseThemeTsTokens(ts: string): Record<string, [number, number, number]> {
  const rootMatch = ts.match(/:root\s*\{([\s\S]*?)\n\s{2}\}/);
  if (!rootMatch) throw new Error('no :root block found in theme.ts THEME_CSS template literal');
  return parseTokenDecls(rootMatch[1]!);
}

function parseTokenDecls(body: string): Record<string, [number, number, number]> {
  const tokens: Record<string, [number, number, number]> = {};
  const tokenRe = /(--chq-[a-z0-9-]+)\s*:\s*#([0-9a-fA-F]{6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body)) !== null) {
    tokens[m[1]!] = hexToRgb(m[2]!);
  }
  return tokens;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function parseRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1]!.trim();
    if (selector.startsWith('@')) continue;
    rules.push({ selector, body: m[2]! });
  }
  return rules;
}

function ruleBody(css: string, selector: string): string {
  const rules = parseRules(css);
  const hit = rules.find((r) => r.selector === selector);
  if (!hit) throw new Error(`selector not found: ${selector}`);
  return hit.body;
}

function declValue(body: string, prop: string): string {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`);
  const m = body.match(re);
  if (!m) throw new Error(`declaration ${prop} not found in rule body: ${body}`);
  return m[1]!.trim();
}

function resolveVar(tokens: Record<string, [number, number, number]>, value: string): [number, number, number] {
  const m = value.match(/var\((--chq-[a-z0-9-]+)\)/);
  if (!m) throw new Error(`expected a var(--chq-*) reference, got: ${value}`);
  const token = tokens[m[1]!];
  if (!token) throw new Error(`token ${m[1]} not found`);
  return token;
}

const STYLES_TOKENS = parseRootTokens(STYLES_CSS);
const THEME_TOKENS = parseThemeTsTokens(THEME_TS);

describe('token-mirror sync (DEC-372 set equality)', () => {
  it('styles.css and theme.ts declare the same --chq-disabled / --chq-disabled-bg / --chq-muted values', () => {
    for (const name of ['--chq-disabled', '--chq-disabled-bg', '--chq-muted'] as const) {
      expect(STYLES_TOKENS[name], `${name} missing from styles.css`).toBeDefined();
      expect(THEME_TOKENS[name], `${name} missing from theme.ts`).toBeDefined();
      expect(THEME_TOKENS[name]).toEqual(STYLES_TOKENS[name]);
    }
  });
});

describe('review plan editor frozen/destructive controls clear WCAG contrast (DEC-436 wave-25 amendment)', () => {
  it('--chq-disabled clears the 3:1 disabled-control floor against --chq-disabled-bg', () => {
    const fg = STYLES_TOKENS['--chq-disabled']!;
    const bg = STYLES_TOKENS['--chq-disabled-bg']!;
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(CONTRAST_MIN_RATIO_LARGE);
  });

  it('--chq-disabled clears the 3:1 disabled-control floor against every ordinary page ground', () => {
    const fg = STYLES_TOKENS['--chq-disabled']!;
    for (const groundName of ['--chq-paper', '--chq-surface', '--chq-surface-sunk'] as const) {
      const bg = STYLES_TOKENS[groundName]!;
      expect(
        contrastRatio(fg, bg),
        `--chq-disabled vs ${groundName}`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN_RATIO_LARGE);
    }
  });

  it('.chq-review-checkbox-label frozen (disabled-field) colour pair clears 3:1', () => {
    const body = ruleBody(REVIEW_CSS, '.chq-review-field-disabled .chq-review-checkbox-label');
    const fg = resolveVar(STYLES_TOKENS, declValue(body, 'color'));
    const bg = resolveVar(STYLES_TOKENS, declValue(body, 'background'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(CONTRAST_MIN_RATIO_LARGE);
  });

  it('.chq-review-editor-footer-delete:disabled clears the full 4.5:1 floor (live destructive action, no disabled exemption)', () => {
    const body = ruleBody(REVIEW_CSS, '.chq-review-editor-footer-delete:disabled');
    const fg = resolveVar(STYLES_TOKENS, declValue(body, 'color'));
    // The delete link renders directly on the editor's page ground; check
    // against every ordinary ground it could sit on.
    for (const groundName of ['--chq-paper', '--chq-surface', '--chq-surface-sunk'] as const) {
      const bg = STYLES_TOKENS[groundName]!;
      expect(
        contrastRatio(fg, bg),
        `.chq-review-editor-footer-delete:disabled vs ${groundName}`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN_RATIO);
    }
  });

  it('.chq-review-editor-footer-delete:disabled does not reuse --chq-disabled (that token only earns the 3:1 exemption)', () => {
    const body = ruleBody(REVIEW_CSS, '.chq-review-editor-footer-delete:disabled');
    expect(declValue(body, 'color')).not.toBe('var(--chq-disabled)');
  });
});
