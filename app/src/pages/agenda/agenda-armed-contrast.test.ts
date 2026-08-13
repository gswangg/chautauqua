// DEC-938: the armed clash card was quieted with `opacity: 0.55`, which
// fades the card's text along with its fill — both blend toward the page
// background together, so the on-ink text over the blended fill measured
// only 3.56:1, below the 4.5:1 AA floor for body text. This test parses the
// actual token values from styles.css and the actual armed-state rules from
// agenda.css (not hand-copied hex literals) and computes real WCAG
// relative-luminance contrast ratios, so the remedy cannot silently regress
// if either file's colours drift.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
// Strip /* ... */ comments before rule-parsing so a selector immediately
// preceded by a block comment (every armed-state rule in this file has one)
// isn't swallowed into the "selector" capture by the brace-matching regex.
const CSS = readFileSync(join(HERE, 'agenda.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const STYLES_CSS = readFileSync(join(HERE, '..', '..', 'styles.css'), 'utf-8');

/** Parse every `--chq-*: #rrggbb;` custom property out of the :root block in
 * styles.css into a name -> hex map. */
function parseTokens(css: string): Record<string, string> {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) throw new Error('no :root block found in styles.css');
  const body = rootMatch[1]!;
  const tokens: Record<string, string> = {};
  const tokenRe = /(--chq-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body)) !== null) {
    tokens[m[1]!] = m[2]!.toLowerCase();
  }
  return tokens;
}

const TOKENS = parseTokens(STYLES_CSS);

function resolveVar(value: string): string {
  const m = value.match(/var\((--chq-[a-z0-9-]+)\)/);
  if (!m) throw new Error(`expected a var(--chq-*) reference, got: ${value}`);
  const token = TOKENS[m[1]!];
  if (!token) throw new Error(`token ${m[1]} not found in styles.css :root`);
  return token;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Extract the body of a single top-level rule by exact selector match
 * (mirrors the source-scan approach used elsewhere in this file's
 * neighbours, e.g. agenda-card-geometry.test.ts). */
function ruleBody(css: string, selector: string): string {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    if (m[1]!.trim() === selector) return m[2]!;
  }
  throw new Error(`selector not found: ${selector}`);
}

function declValue(body: string, prop: string): string {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`);
  const m = body.match(re);
  if (!m) throw new Error(`declaration ${prop} not found in rule body: ${body}`);
  return m[1]!.trim();
}

describe('agenda armed-state contrast (DEC-938)', () => {
  const clashCardBody = ruleBody(CSS, '.chq-day-grid-armed .chq-day-grid-clash-card');
  const cellBtnBody = ruleBody(CSS, '.chq-day-grid-armed .chq-day-grid-cell-btn');

  it('the armed clash-card rule contains no opacity declaration', () => {
    expect(clashCardBody).not.toMatch(/opacity\s*:/);
  });

  it('armed clash-card text clears 4.5:1 against its own painted fill', () => {
    const fill = resolveVar(declValue(clashCardBody, 'background'));
    const text = resolveVar(declValue(clashCardBody, 'color'));
    const ratio = contrastRatio(fill, text);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('the at-rest armed cell-btn ring clears 3:1 against the quieted clash-card fill', () => {
    const fill = resolveVar(declValue(clashCardBody, 'background'));
    const outline = declValue(cellBtnBody, 'outline');
    const ringColorMatch = outline.match(/var\((--chq-[a-z0-9-]+)\)/);
    if (!ringColorMatch) throw new Error(`expected outline to reference a var(--chq-*): ${outline}`);
    const ring = resolveVar(`var(${ringColorMatch[1]})`);
    const ratio = contrastRatio(fill, ring);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('the at-rest armed cell-btn ring is a 1px inset outline (not the old doubling 2px)', () => {
    expect(declValue(cellBtnBody, 'outline')).toMatch(/^1px\s+solid/);
    expect(declValue(cellBtnBody, 'outline-offset')).toBe('-1px');
  });

  it('the at-rest armed cell-btn keeps its z-index above the clash card', () => {
    expect(declValue(cellBtnBody, 'z-index')).toBe('6');
  });

  it('the clash-card marker outline is unchanged (1px dashed --chq-on-ink)', () => {
    expect(declValue(clashCardBody, 'outline')).toBe('1px dashed var(--chq-on-ink)');
  });
});
